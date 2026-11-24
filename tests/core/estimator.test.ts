import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateCategoryBreakdown, rankTopBloaters } from '../../src/core/estimator.js';
import type { ParsedStepSummary } from '../../src/core/types.js';

test('estimateCategoryBreakdown attributes tokens proportionally and marks isEstimate', () => {
  const steps: ParsedStepSummary[] = [
    { stepIndex: 0, category: 'user', label: 'User prompt', bytes: 100 },
    { stepIndex: 1, category: 'thinking', label: 'Thinking', bytes: 200 },
    { stepIndex: 2, category: 'tools', label: 'Result: read_file', toolName: 'read_file', bytes: 500 },
    { stepIndex: 3, category: 'assistant', label: 'Answer', bytes: 200 }
  ];

  const breakdown = estimateCategoryBreakdown(steps, 10_000);
  assert.equal(breakdown.isEstimate, true);
  assert.equal(breakdown.totalBytes, 1000);

  const byCategory = new Map(breakdown.categories.map((slice) => [slice.category, slice]));
  assert.equal(byCategory.get('user')?.estimatedTokens, 1000);
  assert.equal(byCategory.get('thinking')?.estimatedTokens, 2000);
  assert.equal(byCategory.get('tools')?.estimatedTokens, 5000);
  assert.equal(byCategory.get('assistant')?.estimatedTokens, 2000);
  assert.equal(byCategory.get('system')?.estimatedTokens, 0);
  assert.equal(byCategory.get('tools')?.sharePct, 50);
});

test('estimateCategoryBreakdown and rankTopBloaters handle empty and zero-token inputs safely', () => {
  const emptyBreakdown = estimateCategoryBreakdown([], 0);
  assert.equal(emptyBreakdown.isEstimate, true);
  assert.equal(emptyBreakdown.totalBytes, 0);
  assert.ok(emptyBreakdown.categories.every((slice) => slice.estimatedTokens === 0 && slice.sharePct === 0));

  assert.deepEqual(rankTopBloaters([], 5000), []);
});

test('rankTopBloaters sorts descending by byte size and respects limit', () => {
  const steps: ParsedStepSummary[] = [
    { stepIndex: 0, category: 'user', label: 'Small user', bytes: 50 },
    { stepIndex: 1, category: 'tools', label: 'Result: big_log', toolName: 'run_command', bytes: 800 },
    { stepIndex: 2, category: 'tools', label: 'Result: medium_file', toolName: 'read_file', bytes: 150 }
  ];

  const topTwo = rankTopBloaters(steps, 1000, 2);
  assert.equal(topTwo.length, 2);
  assert.equal(topTwo[0]?.label, 'Result: big_log');
  assert.equal(topTwo[0]?.estimatedTokens, 800);
  assert.equal(topTwo[0]?.sharePct, 80);
  assert.equal(topTwo[1]?.label, 'Result: medium_file');
  assert.equal(topTwo[1]?.estimatedTokens, 150);
});
