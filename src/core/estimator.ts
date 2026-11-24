import type {
  BloaterItem,
  CategoryBreakdown,
  CategoryKey,
  CategorySlice,
  ParsedStepSummary
} from './types.js';

const CATEGORY_ORDER: CategoryKey[] = ['user', 'assistant', 'thinking', 'tools', 'system'];

export function estimateCategoryBreakdown(
  steps: ReadonlyArray<ParsedStepSummary>,
  totalInputTokens: number
): CategoryBreakdown {
  const byteTotals: Record<CategoryKey, number> = {
    user: 0,
    assistant: 0,
    thinking: 0,
    tools: 0,
    system: 0
  };

  let totalBytes = 0;
  for (const step of steps) {
    const bytes = typeof step.bytes === 'number' && Number.isFinite(step.bytes) && step.bytes > 0 ? step.bytes : 0;
    byteTotals[step.category] += bytes;
    totalBytes += bytes;
  }

  const safeTokens =
    typeof totalInputTokens === 'number' && Number.isFinite(totalInputTokens) && totalInputTokens > 0
      ? totalInputTokens
      : 0;

  const categories: CategorySlice[] = CATEGORY_ORDER.map((category) => {
    const bytes = byteTotals[category];
    const ratio = totalBytes > 0 ? bytes / totalBytes : 0;
    return {
      category,
      bytes,
      estimatedTokens: Math.round(safeTokens * ratio),
      sharePct: totalBytes > 0 ? Number((ratio * 100).toFixed(1)) : 0
    };
  });

  return {
    isEstimate: true,
    totalBytes,
    categories
  };
}

export function rankTopBloaters(
  steps: ReadonlyArray<ParsedStepSummary>,
  totalInputTokens: number,
  limit = 10
): BloaterItem[] {
  if (!Array.isArray(steps) || steps.length === 0 || limit <= 0) {
    return [];
  }

  let totalBytes = 0;
  for (const step of steps) {
    if (typeof step.bytes === 'number' && Number.isFinite(step.bytes) && step.bytes > 0) {
      totalBytes += step.bytes;
    }
  }

  if (totalBytes <= 0) {
    return [];
  }

  const safeTokens =
    typeof totalInputTokens === 'number' && Number.isFinite(totalInputTokens) && totalInputTokens > 0
      ? totalInputTokens
      : 0;

  const sorted = [...steps]
    .filter((step) => typeof step.bytes === 'number' && Number.isFinite(step.bytes) && step.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, limit);

  return sorted.map((step) => {
    const ratio = step.bytes / totalBytes;
    return {
      stepIndex: step.stepIndex,
      category: step.category,
      stepKind: step.stepKind,
      label: step.label,
      toolName: step.toolName,
      toolCounts: step.toolCounts,
      targets: step.targets,
      bytes: step.bytes,
      estimatedTokens: Math.round(safeTokens * ratio),
      sharePct: Number((ratio * 100).toFixed(1)),
      createdAt: step.createdAt
    };
  });
}
