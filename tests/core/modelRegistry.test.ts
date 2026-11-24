import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveModelLimit } from '../../src/core/modelRegistry.js';

test('resolveModelLimit resolves exact and prefix catalog entries', () => {
  const neon = resolveModelLimit('gemini-4-neon-high');
  assert.equal(neon.source, 'catalog');
  assert.equal(neon.contextLimit, 1_000_000);
  assert.equal(neon.compactionThresholdPct, 80);

  const claude = resolveModelLimit('claude-sonnet-4-20250514');
  assert.equal(claude.source, 'catalog');
  assert.equal(claude.contextLimit, 200_000);
  assert.equal(claude.compactionThresholdPct, 85);

  const gpt4o = resolveModelLimit('models/gpt-4o-mini');
  assert.equal(gpt4o.source, 'catalog');
  assert.equal(gpt4o.contextLimit, 128_000);
});

test('resolveModelLimit prioritizes user overrides over built-in catalog', () => {
  const overrides = {
    'gemini-4-neon': { contextLimit: 500_000, compactionThresholdPct: 75 },
    'custom-local-llm': { contextLimit: 32_768 }
  };

  const overriddenNeon = resolveModelLimit('gemini-4-neon-medium', overrides);
  assert.equal(overriddenNeon.source, 'override');
  assert.equal(overriddenNeon.contextLimit, 500_000);
  assert.equal(overriddenNeon.compactionThresholdPct, 75);

  const custom = resolveModelLimit('custom-local-llm', overrides);
  assert.equal(custom.source, 'override');
  assert.equal(custom.contextLimit, 32_768);
  assert.equal(custom.compactionThresholdPct, 85);
});

test('resolveModelLimit returns unknown null limits for unrecognized models', () => {
  const unknown = resolveModelLimit('totally-unknown-model-v9');
  assert.equal(unknown.source, 'unknown');
  assert.equal(unknown.contextLimit, null);
  assert.equal(unknown.compactionThresholdPct, null);

  const empty = resolveModelLimit(null);
  assert.equal(empty.source, 'unknown');
  assert.equal(empty.contextLimit, null);
});
