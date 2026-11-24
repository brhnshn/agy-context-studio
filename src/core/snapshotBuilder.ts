import { readPluginConfig } from './configStore.js';
import { estimateCategoryBreakdown, rankTopBloaters } from './estimator.js';
import { resolveModelLimit } from './modelRegistry.js';
import { resolveTranscriptPath } from './paths.js';
import { aggregateSubagents } from './subagentAggregator.js';
import { IncrementalTranscriptReader } from './transcriptParser.js';
import type { ContextSnapshot, PluginConfig } from './types.js';

export interface BuildSnapshotOptions {
  antigravityHome?: string;
  pluginDataDir?: string;
  transcriptPath?: string;
  config?: PluginConfig;
  reader?: IncrementalTranscriptReader;
  bloaterLimit?: number;
}

export async function buildContextSnapshot(
  conversationId: string,
  options: BuildSnapshotOptions = {}
): Promise<ContextSnapshot> {
  const reader = options.reader ?? new IncrementalTranscriptReader();
  const config = options.config ?? (await readPluginConfig(options.pluginDataDir));
  const transcriptPath =
    options.transcriptPath ?? resolveTranscriptPath(conversationId, options.antigravityHome);

  const parsed = await reader.readIncremental(transcriptPath);
  const updatedAt = new Date().toISOString();

  if (!parsed) {
    const emptyLimit = resolveModelLimit(null, config.modelOverrides);
    return {
      schemaVersion: 1,
      conversationId,
      transcriptPath,
      status: 'missing',
      model: null,
      modelLimit: emptyLimit,
      uncachedInputTokens: 0,
      cacheReadTokens: 0,
      totalInputTokens: 0,
      outputTokens: 0,
      turnCacheHitRate: 0,
      cumulativeUncachedInputTokens: 0,
      cumulativeCacheReadTokens: 0,
      cumulativeTotalInputTokens: 0,
      cumulativeOutputTokens: 0,
      cumulativeCacheHitRate: 0,
      usagePct: null,
      compactionPct: null,
      turnCount: 0,
      compactionCount: 0,
      velocityTokensPerTurn: null,
      breakdown: estimateCategoryBreakdown([], 0),
      topBloaters: [],
      subagents: [],
      firstTimestamp: null,
      lastTimestamp: null,
      updatedAt
    };
  }

  const latestTurn = parsed.latestTurn;
  const uncachedInputTokens = latestTurn?.uncachedInputTokens ?? 0;
  const cacheReadTokens = latestTurn?.cacheReadTokens ?? 0;
  const totalInputTokens = latestTurn?.totalInputTokens ?? 0;
  const outputTokens = latestTurn?.outputTokens ?? 0;
  const turnCacheHitRate = latestTurn?.turnCacheHitRate ?? 0;

  const modelLimit = resolveModelLimit(parsed.model, config.modelOverrides);
  const usagePct =
    modelLimit.contextLimit && modelLimit.contextLimit > 0
      ? Number(((totalInputTokens / modelLimit.contextLimit) * 100).toFixed(2))
      : null;

  const subagents = await aggregateSubagents(parsed.subagentRefs, reader, {
    antigravityHome: options.antigravityHome,
    visited: new Set([conversationId])
  });

  return {
    schemaVersion: 1,
    conversationId,
    transcriptPath,
    status: parsed.turnCount === 0 && parsed.steps.length === 0 ? 'empty' : 'ok',
    model: parsed.model,
    modelLimit,
    uncachedInputTokens,
    cacheReadTokens,
    totalInputTokens,
    outputTokens,
    turnCacheHitRate,
    cumulativeUncachedInputTokens: parsed.cumulativeUncachedInputTokens,
    cumulativeCacheReadTokens: parsed.cumulativeCacheReadTokens,
    cumulativeTotalInputTokens: parsed.cumulativeTotalInputTokens,
    cumulativeOutputTokens: parsed.cumulativeOutputTokens,
    cumulativeCacheHitRate: parsed.cumulativeCacheHitRate,
    usagePct,
    compactionPct: modelLimit.compactionThresholdPct,
    turnCount: parsed.turnCount,
    compactionCount: parsed.compactionCount,
    velocityTokensPerTurn: parsed.velocityTokensPerTurn,
    breakdown: estimateCategoryBreakdown(parsed.steps, totalInputTokens),
    topBloaters: rankTopBloaters(parsed.steps, totalInputTokens, options.bloaterLimit ?? 10),
    subagents,
    firstTimestamp: parsed.firstTimestamp,
    lastTimestamp: parsed.lastTimestamp,
    updatedAt
  };
}
