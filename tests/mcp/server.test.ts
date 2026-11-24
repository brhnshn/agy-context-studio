import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CONTEXT_CARD_URI } from '../../src/mcp/cardHtml.js';
import { handleMcpRequest } from '../../src/mcp/server.js';

test('Opt-in MCP App server handles initialize, tools/list, tools/call, and resources/read', async (t) => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-ctx-mcp-'));
  t.after(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  const homeDir = path.join(rootDir, 'antigravity');
  const dataDir = path.join(rootDir, 'plugin-data');
  const convId = 'mcp-test-conv';
  const transcriptPath = path.join(
    homeDir,
    'brain',
    convId,
    '.system_generated',
    'logs',
    'transcript.jsonl'
  );
  await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
  await fs.writeFile(
    transcriptPath,
    `${JSON.stringify({
      step_index: 0,
      type: 'PLANNER_RESPONSE',
      created_at: new Date().toISOString(),
      model: 'gemini-4-neon-medium',
      input_tokens: 10_000,
      cache_read_tokens: 40_000,
      output_tokens: 300,
      content: 'Ready.'
    })}\n`,
    'utf8'
  );

  const initRes = await handleMcpRequest(
    { jsonrpc: '2.0', id: 1, method: 'initialize' },
    { antigravityHome: homeDir, pluginDataDir: dataDir }
  );
  assert.ok(initRes?.result);

  const listRes = await handleMcpRequest(
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { antigravityHome: homeDir, pluginDataDir: dataDir }
  );
  const tools = (listRes?.result as { tools: Array<{ name: string; _meta: { ui: { resourceUri: string } } }> }).tools;
  assert.equal(tools[0]?.name, 'get_context_health');
  assert.equal(tools[0]?._meta.ui.resourceUri, CONTEXT_CARD_URI);

  const callRes = await handleMcpRequest(
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'get_context_health', arguments: { conversationId: convId } }
    },
    { antigravityHome: homeDir, pluginDataDir: dataDir }
  );
  const callResult = callRes?.result as {
    content: Array<{ text: string }>;
    structuredContent: { totalInputTokens: number };
  };
  assert.match(callResult.content[0]?.text ?? '', /50,000/);
  assert.equal(callResult.structuredContent.totalInputTokens, 50_000);

  const resRead = await handleMcpRequest(
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/read',
      params: { uri: CONTEXT_CARD_URI }
    },
    { antigravityHome: homeDir, pluginDataDir: dataDir }
  );
  const contents = (resRead?.result as { contents: Array<{ mimeType: string; text: string }> }).contents;
  assert.equal(contents[0]?.mimeType, 'text/html;profile=mcp-app');
  assert.match(contents[0]?.text ?? '', /ui\/initialize/);
});
