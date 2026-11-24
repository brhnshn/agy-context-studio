import type { ModelLimitInfo, ModelOverride } from './types.js';

interface CatalogEntry {
  pattern: string;
  contextLimit: number;
  compactionThresholdPct: number;
}

const MODEL_LIMIT_CATALOG: CatalogEntry[] = [
  { pattern: 'gemini-4-neon', contextLimit: 1_000_000, compactionThresholdPct: 80 },
  { pattern: 'gemini-4', contextLimit: 1_000_000, compactionThresholdPct: 80 },
  { pattern: 'gemini-3.5', contextLimit: 1_000_000, compactionThresholdPct: 80 },
  { pattern: 'gemini-3', contextLimit: 1_000_000, compactionThresholdPct: 80 },
  { pattern: 'gemini-2.5-pro', contextLimit: 1_000_000, compactionThresholdPct: 80 },
  { pattern: 'gemini-2.5-flash', contextLimit: 1_000_000, compactionThresholdPct: 80 },
  { pattern: 'gemini-2.0', contextLimit: 1_000_000, compactionThresholdPct: 80 },
  { pattern: 'claude-opus-4', contextLimit: 200_000, compactionThresholdPct: 85 },
  { pattern: 'claude-sonnet-4', contextLimit: 200_000, compactionThresholdPct: 85 },
  { pattern: 'claude-3-7-sonnet', contextLimit: 200_000, compactionThresholdPct: 85 },
  { pattern: 'claude-3-5-sonnet', contextLimit: 200_000, compactionThresholdPct: 85 },
  { pattern: 'claude-3-5-haiku', contextLimit: 200_000, compactionThresholdPct: 85 },
  { pattern: 'gpt-5', contextLimit: 400_000, compactionThresholdPct: 85 },
  { pattern: 'gpt-4.1', contextLimit: 1_000_000, compactionThresholdPct: 85 },
  { pattern: 'gpt-4o', contextLimit: 128_000, compactionThresholdPct: 85 },
  { pattern: 'o4-mini', contextLimit: 200_000, compactionThresholdPct: 85 },
  { pattern: 'o3', contextLimit: 200_000, compactionThresholdPct: 85 }
];

function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/^models\//, '');
}

export function getBuiltinModelCatalog(): ReadonlyArray<CatalogEntry> {
  return MODEL_LIMIT_CATALOG;
}

export function resolveModelLimit(
  modelId: string | null | undefined,
  overrides?: Record<string, ModelOverride>
): ModelLimitInfo {
  if (!modelId || modelId.trim().length === 0) {
    return {
      modelId: null,
      matchedPattern: null,
      contextLimit: null,
      compactionThresholdPct: null,
      source: 'unknown'
    };
  }

  const normalized = normalizeModelId(modelId);

  if (overrides) {
    // Exact normalized match first
    for (const [pattern, override] of Object.entries(overrides)) {
      if (normalizeModelId(pattern) === normalized && override.contextLimit > 0) {
        return {
          modelId,
          matchedPattern: pattern,
          contextLimit: override.contextLimit,
          compactionThresholdPct: override.compactionThresholdPct ?? 85,
          source: 'override'
        };
      }
    }

    // Longest prefix match in overrides
    const sortedOverrides = Object.entries(overrides)
      .filter(([, override]) => override && override.contextLimit > 0)
      .sort(([a], [b]) => b.length - a.length);

    for (const [pattern, override] of sortedOverrides) {
      if (normalized.startsWith(normalizeModelId(pattern))) {
        return {
          modelId,
          matchedPattern: pattern,
          contextLimit: override.contextLimit,
          compactionThresholdPct: override.compactionThresholdPct ?? 85,
          source: 'override'
        };
      }
    }
  }

  // Exact or prefix match in built-in catalog (longest pattern wins)
  const sortedCatalog = [...MODEL_LIMIT_CATALOG].sort((a, b) => b.pattern.length - a.pattern.length);
  for (const entry of sortedCatalog) {
    if (normalized === entry.pattern || normalized.startsWith(entry.pattern)) {
      return {
        modelId,
        matchedPattern: entry.pattern,
        contextLimit: entry.contextLimit,
        compactionThresholdPct: entry.compactionThresholdPct,
        source: 'catalog'
      };
    }
  }

  return {
    modelId,
    matchedPattern: null,
    contextLimit: null,
    compactionThresholdPct: null,
    source: 'unknown'
  };
}
