import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { writePluginConfig } from '../../src/core/configStore.js';
import { runPostInvocationHook } from '../../src/hooks/post-invocation.js';

async function writeTurnTranscript(filePath: string, totalTokens: number, model = 'claude-sonnet-4'): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const uncached = Math.round(totalTokens * 0.2);
  const cached = totalTokens - uncached;
  await fs.writeFile(
    filePath,
    `${JSON.stringify({
      step_index: 0,
      type: 'PLANNER_RESPONSE',
      created_at: new Date().toISOString(),
      model,
      input_tokens: uncached,
      cache_read_tokens: cached,
      output_tokens: 200,
      content: 'Turn complete'
    })}\n`,
    'utf8'
  );
}

test('PostInvocation hook warns once, dedupes, escalates to critical, and resets after compaction', async (t) => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-ctx-hook-'));
  t.after(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  const dataDir = path.join(rootDir, 'plugin-data');
  const transcriptPath = path.join(rootDir, 'transcript.jsonl');
  const convId = 'hook-test-conv';

  await writePluginConfig(
    {
      language: 'en',
      hookEnabled: true,
      warningThresholdPct: 70,
      criticalThresholdPct: 85
    },
    dataDir
  );

  // 1. 75% of 200k (150k) -> fires warning once with systemMessage: ""
  await writeTurnTranscript(transcriptPath, 150_000);
  const firstOut = await runPostInvocationHook(
    JSON.stringify({ conversationId: convId, transcriptPath }),
    { pluginDataDir: dataDir }
  );
  assert.equal(firstOut.injectSteps?.length, 1);
  assert.equal(firstOut.injectSteps?.[0]?.systemMessage.systemMessage, '');
  assert.match(
    firstOut.injectSteps?.[0]?.systemMessage.metadata.user_markdown ?? '',
    /Context Warning \(75\.0%\)/
  );

  // 2. 78% (156k) -> deduped, does not re-fire
  await writeTurnTranscript(transcriptPath, 156_000);
  const dedupedOut = await runPostInvocationHook(
    JSON.stringify({ conversationId: convId, transcriptPath }),
    { pluginDataDir: dataDir }
  );
  assert.deepEqual(dedupedOut, {});

  // 3. 90% (180k) -> escalates to critical
  await writeTurnTranscript(transcriptPath, 180_000);
  const criticalOut = await runPostInvocationHook(
    JSON.stringify({ conversationId: convId, transcriptPath }),
    { pluginDataDir: dataDir }
  );
  assert.equal(criticalOut.injectSteps?.length, 1);
  assert.match(
    criticalOut.injectSteps?.[0]?.systemMessage.metadata.user_markdown ?? '',
    /Critical Context Threshold \(90\.0%\)/
  );

  // 4. Compaction drops usage to 30% (60k) -> resets state quietly
  await writeTurnTranscript(transcriptPath, 60_000);
  const postCompactOut = await runPostInvocationHook(
    JSON.stringify({ conversationId: convId, transcriptPath }),
    { pluginDataDir: dataDir }
  );
  assert.deepEqual(postCompactOut, {});

  // 5. Rises again to 72% (144k) in Turkish -> fires warning again
  await writePluginConfig({ language: 'tr' }, dataDir);
  await writeTurnTranscript(transcriptPath, 144_000);
  const reWarnOut = await runPostInvocationHook(
    JSON.stringify({ conversationId: convId, transcriptPath }),
    { pluginDataDir: dataDir }
  );
  assert.equal(reWarnOut.injectSteps?.length, 1);
  assert.match(
    reWarnOut.injectSteps?.[0]?.systemMessage.metadata.user_markdown ?? '',
    /Bağlam Uyarısı \(72\.0%\)/
  );

  // 6. Disabled hook returns {}
  await writePluginConfig({ hookEnabled: false }, dataDir);
  await writeTurnTranscript(transcriptPath, 190_000);
  const disabledOut = await runPostInvocationHook(
    JSON.stringify({ conversationId: convId, transcriptPath }),
    { pluginDataDir: dataDir }
  );
  assert.deepEqual(disabledOut, {});
});
