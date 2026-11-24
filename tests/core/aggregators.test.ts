import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_PLUGIN_CONFIG,
  readPluginConfig,
  writePluginConfig
} from '../../src/core/configStore.js';
import { aggregateUsageHistory } from '../../src/core/historyAggregator.js';
import { buildContextSnapshot } from '../../src/core/snapshotBuilder.js';
import { aggregateSubagents } from '../../src/core/subagentAggregator.js';
import { IncrementalTranscriptReader } from '../../src/core/transcriptParser.js';

async function writeTranscript(homeDir: string, conversationId: string, lines: unknown[]): Promise<string> {
  const filePath = path.join(homeDir, 'brain', conversationId, '.system_generated', 'logs', 'transcript.jsonl');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf8');
  return filePath;
}

test('configStore reads defaults and persists clamped overrides atomically', async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-ctx-cfg-'));
  t.after(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const initial = await readPluginConfig(dataDir);
  assert.deepEqual(initial, DEFAULT_PLUGIN_CONFIG);

  const updated = await writePluginConfig(
    {
      language: 'tr',
      hookEnabled: false,
      warningThresholdPct: 80,
      criticalThresholdPct: 75, // Should clamp above warning (85)
      modelOverrides: {
        'custom-model': { contextLimit: 64_000, compactionThresholdPct: 90 }
      }
    },
    dataDir
  );

  assert.equal(updated.language, 'tr');
  assert.equal(updated.hookEnabled, false);
  assert.equal(updated.warningThresholdPct, 80);
  assert.equal(updated.criticalThresholdPct, 85);
  assert.equal(updated.modelOverrides['custom-model']?.contextLimit, 64_000);

  const reread = await readPluginConfig(dataDir);
  assert.deepEqual(reread, updated);
});

test('aggregateSubagents resolves active, missing, and cyclic subagent transcripts', async (t) => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-ctx-subagg-'));
  t.after(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  const childId = 'child-conv-1';
  const missingId = 'missing-conv-2';
  const childPath = await writeTranscript(homeDir, childId, [
    {
      step_index: 0,
      type: 'PLANNER_RESPONSE',
      created_at: '2026-11-24T19:00:00Z',
      model: 'gemini-3-flash',
      input_tokens: 4000,
      cache_read_tokens: 1000,
      output_tokens: 250,
      content: 'Child finished.'
    }
  ]);

  const reader = new IncrementalTranscriptReader();
  const summaries = await aggregateSubagents(
    [
      { conversationId: childId, transcriptPath: childPath, role: 'Researcher', spawnedAtStep: 1 },
      { conversationId: childId, transcriptPath: childPath, role: 'DuplicateCycle', spawnedAtStep: 2 },
      { conversationId: missingId, role: 'MissingWorker', spawnedAtStep: 3 }
    ],
    reader,
    { antigravityHome: homeDir }
  );

  assert.equal(summaries.length, 2);
  assert.equal(summaries[0]?.status, 'active');
  assert.equal(summaries[0]?.totalInputTokens, 5000);
  assert.equal(summaries[0]?.turnCount, 1);
  assert.equal(summaries[1]?.status, 'missing');
  assert.equal(summaries[1]?.conversationId, missingId);
});

test('aggregateUsageHistory aggregates multi-day usage within window', async (t) => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-ctx-hist-'));
  t.after(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  await writeTranscript(homeDir, 'conv-a', [
    {
      step_index: 0,
      type: 'PLANNER_RESPONSE',
      created_at: '2026-11-23T12:00:00Z',
      model: 'gemini-4-neon-medium',
      input_tokens: 1000,
      cache_read_tokens: 3000,
      output_tokens: 200
    },
    {
      step_index: 1,
      type: 'PLANNER_RESPONSE',
      created_at: '2026-11-24T12:00:00Z',
      model: 'gemini-4-neon-medium',
      input_tokens: 500,
      cache_read_tokens: 4500,
      output_tokens: 300
    }
  ]);

  const history = await aggregateUsageHistory({
    days: 7,
    antigravityHome: homeDir,
    now: new Date('2026-11-24T23:00:00Z')
  });

  assert.equal(history.days, 7);
  assert.equal(history.daily.length, 7);
  assert.equal(history.totals.sessions, 1);
  assert.equal(history.totals.turns, 2);
  assert.equal(history.totals.totalInputTokens, 9000);
  assert.equal(history.totals.cacheReadTokens, 7500);
  assert.equal(history.totals.outputTokens, 500);

  const day23 = history.daily.find((d) => d.date === '2026-11-23');
  const day24 = history.daily.find((d) => d.date === '2026-11-24');
  assert.equal(day23?.totalInputTokens, 4000);
  assert.equal(day24?.totalInputTokens, 5000);
});

test('buildContextSnapshot integrates transcript, model limits, bloaters, and subagents', async (t) => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-ctx-snap-'));
  t.after(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  const homeDir = path.join(rootDir, 'antigravity');
  const dataDir = path.join(rootDir, 'plugin-data');
  const mainId = 'main-conv-1';
  const subId = 'sub-conv-2';

  const subPath = await writeTranscript(homeDir, subId, [
    {
      step_index: 0,
      type: 'PLANNER_RESPONSE',
      created_at: '2026-11-24T20:01:00Z',
      model: 'gemini-2.5-flash',
      input_tokens: 2000,
      cache_read_tokens: 8000,
      output_tokens: 400
    }
  ]);

  await writeTranscript(homeDir, mainId, [
    {
      step_index: 0,
      type: 'USER_INPUT',
      created_at: '2026-11-24T20:00:00Z',
      content: 'Audit this codebase.'
    },
    {
      step_index: 1,
      type: 'PLANNER_RESPONSE',
      created_at: '2026-11-24T20:00:05Z',
      model: 'claude-sonnet-4',
      input_tokens: 50000,
      cache_read_tokens: 50000,
      output_tokens: 600,
      tool_calls: [{ name: 'invoke_subagent', args: { Role: 'Auditor', TypeName: 'research' } }]
    },
    {
      step_index: 2,
      type: 'GENERIC',
      created_at: '2026-11-24T20:00:06Z',
      content: `Created the following subagent:\n{"conversationId":"${subId}","logAbsoluteUri":"file:///${subPath.replace(/\\/g, '/')}"}`
    }
  ]);

  const snapshot = await buildContextSnapshot(mainId, {
    antigravityHome: homeDir,
    pluginDataDir: dataDir
  });

  assert.equal(snapshot.status, 'ok');
  assert.equal(snapshot.model, 'claude-sonnet-4');
  assert.equal(snapshot.modelLimit.contextLimit, 200_000);
  assert.equal(snapshot.totalInputTokens, 100_000);
  assert.equal(snapshot.usagePct, 50);
  assert.equal(snapshot.compactionPct, 85);
  assert.equal(snapshot.breakdown.isEstimate, true);
  assert.ok(snapshot.topBloaters.length >= 2);
  assert.equal(snapshot.subagents.length, 1);
  assert.equal(snapshot.subagents[0]?.conversationId, subId);
  assert.equal(snapshot.subagents[0]?.totalInputTokens, 10_000);

  const missingSnapshot = await buildContextSnapshot('non-existent-id', {
    antigravityHome: homeDir,
    pluginDataDir: dataDir
  });
  assert.equal(missingSnapshot.status, 'missing');
  assert.equal(missingSnapshot.usagePct, null);
});
