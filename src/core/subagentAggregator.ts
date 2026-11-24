import { resolveTranscriptPath } from './paths.js';
import type { IncrementalTranscriptReader } from './transcriptParser.js';
import type { SubagentRef, SubagentSummary } from './types.js';

export interface AggregateSubagentsOptions {
  antigravityHome?: string;
  maxDepth?: number;
  visited?: Set<string>;
  depth?: number;
}

export async function aggregateSubagents(
  refs: ReadonlyArray<SubagentRef>,
  reader: IncrementalTranscriptReader,
  options: AggregateSubagentsOptions = {}
): Promise<SubagentSummary[]> {
  const maxDepth = options.maxDepth ?? 3;
  const depth = options.depth ?? 0;
  const visited = options.visited ?? new Set<string>();

  if (depth >= maxDepth || refs.length === 0) {
    return [];
  }

  const summaries: SubagentSummary[] = [];

  for (const ref of refs) {
    if (visited.has(ref.conversationId)) {
      continue;
    }
    visited.add(ref.conversationId);

    const transcriptPath =
      ref.transcriptPath ?? resolveTranscriptPath(ref.conversationId, options.antigravityHome);
    const parsed = await reader.readIncremental(transcriptPath);

    if (!parsed) {
      summaries.push({
        conversationId: ref.conversationId,
        transcriptPath,
        role: ref.role,
        typeName: ref.typeName,
        status: 'missing',
        model: null,
        totalInputTokens: 0,
        uncachedInputTokens: 0,
        cacheReadTokens: 0,
        outputTokens: 0,
        cacheHitRate: 0,
        turnCount: 0,
        lastTimestamp: ref.createdAt ?? null,
        children: []
      });
      continue;
    }

    const children =
      parsed.subagentRefs.length > 0
        ? await aggregateSubagents(parsed.subagentRefs, reader, {
            antigravityHome: options.antigravityHome,
            maxDepth,
            visited,
            depth: depth + 1
          })
        : [];

    summaries.push({
      conversationId: ref.conversationId,
      transcriptPath,
      role: ref.role,
      typeName: ref.typeName,
      status: 'active',
      model: parsed.model,
      totalInputTokens: parsed.latestTurn?.totalInputTokens ?? 0,
      uncachedInputTokens: parsed.cumulativeUncachedInputTokens,
      cacheReadTokens: parsed.cumulativeCacheReadTokens,
      outputTokens: parsed.cumulativeOutputTokens,
      cacheHitRate: parsed.cumulativeCacheHitRate,
      turnCount: parsed.turnCount,
      lastTimestamp: parsed.lastTimestamp,
      children
    });
  }

  return summaries;
}
