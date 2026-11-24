import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSidecarServer } from '../../src/sidecar/server.js';

async function writeTranscript(homeDir: string, conversationId: string, lines: unknown[]): Promise<string> {
  const filePath = path.join(homeDir, 'brain', conversationId, '.system_generated', 'logs', 'transcript.jsonl');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf8');
  return filePath;
}

test('Sidecar server serves health, conversations, state, history, settings, and SSE events', async (t) => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-ctx-sidecar-'));
  t.after(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  const homeDir = path.join(rootDir, 'antigravity');
  const dataDir = path.join(rootDir, 'plugin-data');
  const publicDir = path.join(rootDir, 'public');
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(path.join(publicDir, 'index.html'), '<html><body>OK</body></html>', 'utf8');

  const convId = 'sidecar-test-conv-1';
  const transcriptPath = await writeTranscript(homeDir, convId, [
    {
      step_index: 0,
      type: 'USER_INPUT',
      created_at: new Date().toISOString(),
      content: 'Hello sidecar'
    },
    {
      step_index: 1,
      type: 'PLANNER_RESPONSE',
      created_at: new Date().toISOString(),
      model: 'gemini-4-neon-medium',
      input_tokens: 20_000,
      cache_read_tokens: 30_000,
      output_tokens: 450,
      content: 'Initial response'
    }
  ]);

  const instance = await createSidecarServer({
    port: 0,
    antigravityHome: homeDir,
    pluginDataDir: dataDir,
    publicDir,
    debounceMs: 50
  });
  t.after(async () => {
    await instance.close();
  });

  const baseUrl = `http://${instance.host}:${instance.port}`;

  // 1. Health & static asset
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthRes.status, 200);
  const healthJson = (await healthRes.json()) as { status: string; activeConversations: number };
  assert.equal(healthJson.status, 'ok');
  assert.equal(healthJson.activeConversations, 1);

  const htmlRes = await fetch(`${baseUrl}/`);
  assert.equal(htmlRes.status, 200);
  assert.match(await htmlRes.text(), /OK/);

  // 2. Conversations, Models & State
  const convRes = await fetch(`${baseUrl}/api/conversations`);
  const convJson = (await convRes.json()) as { conversations: Array<{ conversationId: string }> };
  assert.equal(convJson.conversations[0]?.conversationId, convId);

  const modelsRes = await fetch(`${baseUrl}/api/models`);
  assert.equal(modelsRes.status, 200);
  const modelsJson = (await modelsRes.json()) as {
    models: Array<{ id: string; contextLimit: number | null; source: string }>;
  };
  assert.ok(modelsJson.models.some((m) => m.id === 'gemini-4-neon-medium' && m.source === 'detected'));
  assert.equal(modelsJson.models.some((m) => m.id === 'gpt-4o'), false);

  const stateRes = await fetch(`${baseUrl}/api/state?conversationId=${convId}`);
  const stateJson = (await stateRes.json()) as { totalInputTokens: number; usagePct: number };
  assert.equal(stateJson.totalInputTokens, 50_000);
  assert.equal(stateJson.usagePct, 5);

  // 3. Settings GET/PUT
  const putRes = await fetch(`${baseUrl}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'tr', warningThresholdPct: 65 })
  });
  assert.equal(putRes.status, 200);
  const updatedSettings = (await putRes.json()) as { language: string; warningThresholdPct: number };
  assert.equal(updatedSettings.language, 'tr');
  assert.equal(updatedSettings.warningThresholdPct, 65);

  // 4. History
  const historyRes = await fetch(`${baseUrl}/api/history?days=7`);
  assert.equal(historyRes.status, 200);
  const historyJson = (await historyRes.json()) as { totals: { totalInputTokens: number } };
  assert.equal(historyJson.totals.totalInputTokens, 50_000);

  // 5. SSE initial + live update on append
  const snapshots = await new Promise<Array<{ totalInputTokens: number }>>((resolve, reject) => {
    const received: Array<{ totalInputTokens: number }> = [];
    const req = http.get(`${baseUrl}/api/events?conversationId=${convId}`, (res) => {
      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buffer += chunk;
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const dataLine = frame.split('\n').find((line) => line.startsWith('data: '));
          if (dataLine) {
            received.push(JSON.parse(dataLine.slice(6)) as { totalInputTokens: number });
            if (received.length === 1) {
              // Trigger live file append after initial snapshot
              void fs.appendFile(
                transcriptPath,
                `${JSON.stringify({
                  step_index: 2,
                  type: 'PLANNER_RESPONSE',
                  created_at: new Date().toISOString(),
                  model: 'gemini-4-neon-medium',
                  input_tokens: 5_000,
                  cache_read_tokens: 55_000,
                  output_tokens: 300,
                  content: 'Updated turn'
                })}\n`,
                'utf8'
              );
            } else if (received.length >= 2) {
              req.destroy();
              resolve(received);
            }
          }
        }
      });
      res.on('error', reject);
    });
    req.on('error', (err) => {
      if (received.length >= 2) {
        resolve(received);
      } else {
        reject(err);
      }
    });
    setTimeout(() => {
      req.destroy();
      reject(new Error(`Timed out waiting for SSE updates; received ${received.length}`));
    }, 4000).unref();
  });

  assert.equal(snapshots[0]?.totalInputTokens, 50_000);
  assert.equal(snapshots[1]?.totalInputTokens, 60_000);
});
