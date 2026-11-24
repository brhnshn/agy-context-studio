import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { IncrementalTranscriptReader, parseTranscriptFile } from '../../src/core/transcriptParser.js';

function jsonl(lines: unknown[]): string {
  return `${lines.map((item) => JSON.stringify(item)).join('\n')}\n`;
}

test('IncrementalTranscriptReader parses exact token math and cache hit rates', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-ctx-parser-'));
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const filePath = path.join(dir, 'transcript.jsonl');
  await fs.writeFile(
    filePath,
    jsonl([
      {
        step_index: 0,
        source: 'USER_EXPLICIT',
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: '2026-11-24T20:00:00Z',
        content: 'Inspect the repository layout.'
      },
      {
        step_index: 1,
        source: 'MODEL',
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: '2026-11-24T20:00:02Z',
        model: 'gemini-4-neon-high',
        input_tokens: 33436,
        cache_read_tokens: 0,
        output_tokens: 300,
        thinking: 'Checking files first.',
        tool_calls: [{ name: 'run_command', args: { CommandLine: 'ls' } }]
      },
      {
        step_index: 2,
        source: 'MODEL',
        type: 'GENERIC',
        status: 'DONE',
        created_at: '2026-11-24T20:00:03Z',
        content: 'Command exited with code 0.\nREADME.md\nSPEC.md'
      },
      {
        step_index: 3,
        source: 'MODEL',
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: '2026-11-24T20:00:05Z',
        model: 'gemini-4-neon-high',
        input_tokens: 2568,
        cache_read_tokens: 31387,
        output_tokens: 512,
        content: 'Done inspecting.'
      }
    ]),
    'utf8'
  );

  const state = await parseTranscriptFile(filePath);
  assert.ok(state);
  assert.equal(state.model, 'gemini-4-neon-high');
  assert.equal(state.turnCount, 2);
  assert.equal(state.latestTurn?.uncachedInputTokens, 2568);
  assert.equal(state.latestTurn?.cacheReadTokens, 31387);
  assert.equal(state.latestTurn?.totalInputTokens, 33955);
  assert.equal(state.latestTurn?.outputTokens, 512);
  assert.ok(Math.abs((state.latestTurn?.turnCacheHitRate ?? 0) - 31387 / 33955) < 1e-6);

  assert.equal(state.cumulativeUncachedInputTokens, 33436 + 2568);
  assert.equal(state.cumulativeCacheReadTokens, 31387);
  assert.equal(state.cumulativeTotalInputTokens, 33436 + 33955);
  assert.equal(state.cumulativeOutputTokens, 812);
  assert.equal(state.velocityTokensPerTurn, 33955 - 33436);
});

test('IncrementalTranscriptReader handles incremental appends, partial lines, and truncation', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-ctx-inc-'));
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const filePath = path.join(dir, 'transcript.jsonl');
  const reader = new IncrementalTranscriptReader();

  const turn1 = JSON.stringify({
    step_index: 0,
    type: 'PLANNER_RESPONSE',
    created_at: '2026-11-24T20:00:00Z',
    model: 'claude-sonnet-4',
    input_tokens: 10000,
    cache_read_tokens: 0,
    output_tokens: 200,
    content: 'Turn 1'
  });

  await fs.writeFile(filePath, `${turn1}\n`, 'utf8');
  const firstRead = await reader.readIncremental(filePath);
  assert.ok(firstRead);
  assert.equal(firstRead.turnCount, 1);
  assert.equal(firstRead.latestTurn?.totalInputTokens, 10000);
  const firstOffset = firstRead.byteOffset;

  // Append a partial line without trailing newline
  const turn2 = JSON.stringify({
    step_index: 1,
    type: 'PLANNER_RESPONSE',
    created_at: '2026-11-24T20:01:00Z',
    model: 'claude-sonnet-4',
    input_tokens: 2000,
    cache_read_tokens: 10000,
    output_tokens: 250,
    content: 'Turn 2'
  });
  const splitIdx = Math.floor(turn2.length / 2);
  await fs.appendFile(filePath, turn2.slice(0, splitIdx), 'utf8');

  const partialRead = await reader.readIncremental(filePath);
  assert.ok(partialRead);
  assert.equal(partialRead.turnCount, 1);
  assert.equal(partialRead.byteOffset, firstOffset);

  // Complete the trailing line and add a malformed line
  await fs.appendFile(filePath, `${turn2.slice(splitIdx)}\n{invalid_json\n`, 'utf8');

  const secondRead = await reader.readIncremental(filePath);
  assert.ok(secondRead);
  assert.equal(secondRead.turnCount, 2);
  assert.equal(secondRead.latestTurn?.totalInputTokens, 12000);
  assert.ok(secondRead.byteOffset > firstOffset);

  // Truncate/rotate file to a smaller payload
  const rotatedTurn = JSON.stringify({
    step_index: 0,
    type: 'PLANNER_RESPONSE',
    created_at: '2026-11-24T20:05:00Z',
    model: 'gpt-4o',
    input_tokens: 1500,
    cache_read_tokens: 0,
    output_tokens: 100,
    content: 'Fresh rotated session'
  });
  await fs.writeFile(filePath, `${rotatedTurn}\n`, 'utf8');

  const rotatedRead = await reader.readIncremental(filePath);
  assert.ok(rotatedRead);
  assert.equal(rotatedRead.turnCount, 1);
  assert.equal(rotatedRead.model, 'gpt-4o');
  assert.equal(rotatedRead.latestTurn?.totalInputTokens, 1500);
});

test('IncrementalTranscriptReader detects compactions and invoke_subagent references', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-ctx-sub-'));
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const filePath = path.join(dir, 'transcript.jsonl');
  await fs.writeFile(
    filePath,
    jsonl([
      {
        step_index: 0,
        type: 'PLANNER_RESPONSE',
        created_at: '2026-11-24T20:00:00Z',
        model: 'gemini-4-neon-medium',
        input_tokens: 80000,
        cache_read_tokens: 0,
        output_tokens: 100,
        tool_calls: [
          {
            name: 'invoke_subagent',
            args: { Role: 'Codebase Researcher', TypeName: 'research' }
          }
        ]
      },
      {
        step_index: 1,
        type: 'GENERIC',
        created_at: '2026-11-24T20:00:01Z',
        content:
          'Created the following subagent:\n{"conversationId":"11111111-2222-3333-4444-555555555555","logAbsoluteUri":"file:///C:/tmp/sub/transcript.jsonl"}'
      },
      {
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        created_at: '2026-11-24T20:05:00Z',
        model: 'gemini-4-neon-medium',
        input_tokens: 18000,
        cache_read_tokens: 0,
        output_tokens: 150,
        content: 'Compacted context.'
      }
    ]),
    'utf8'
  );

  const state = await parseTranscriptFile(filePath);
  assert.ok(state);
  assert.equal(state.compactionCount, 1);
  assert.equal(state.subagentRefs.length, 1);
  assert.equal(state.subagentRefs[0]?.conversationId, '11111111-2222-3333-4444-555555555555');
  assert.equal(state.subagentRefs[0]?.role, 'Codebase Researcher');
  assert.equal(state.subagentRefs[0]?.typeName, 'research');
});
