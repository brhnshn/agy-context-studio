import { listConversationEntries } from './paths.js';
import { IncrementalTranscriptReader } from './transcriptParser.js';
import type { DailyUsageSummary, UsageHistory } from './types.js';

export interface AggregateUsageHistoryOptions {
  days?: number;
  antigravityHome?: string;
  reader?: IncrementalTranscriptReader;
  now?: Date;
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveTurnDateKey(createdAt: string | undefined, fallbackMtimeMs: number): string {
  if (createdAt) {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return toUtcDateKey(parsed);
    }
  }
  return toUtcDateKey(new Date(fallbackMtimeMs));
}

export async function aggregateUsageHistory(
  options: AggregateUsageHistoryOptions = {}
): Promise<UsageHistory> {
  const days = Math.min(30, Math.max(1, Math.round(options.days ?? 7)));
  const now = options.now ?? new Date();
  const reader = options.reader ?? new IncrementalTranscriptReader();

  // Build ordered date buckets from oldest to newest
  const bucketMap = new Map<string, DailyUsageSummary>();
  const sessionSets = new Map<string, Set<string>>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    const key = toUtcDateKey(dayDate);
    bucketMap.set(key, {
      date: key,
      sessions: 0,
      turns: 0,
      uncachedInputTokens: 0,
      cacheReadTokens: 0,
      totalInputTokens: 0,
      outputTokens: 0,
      cacheHitRate: 0
    });
    sessionSets.set(key, new Set<string>());
  }

  const cutoffMs =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)) - 24 * 60 * 60 * 1000;

  const entries = await listConversationEntries(options.antigravityHome);
  for (const entry of entries) {
    if (entry.mtimeMs < cutoffMs) {
      continue;
    }

    const parsed = await reader.readIncremental(entry.transcriptPath);
    if (!parsed || parsed.turns.length === 0) {
      continue;
    }

    for (const turn of parsed.turns) {
      const key = resolveTurnDateKey(turn.createdAt, entry.mtimeMs);
      const bucket = bucketMap.get(key);
      if (!bucket) {
        continue;
      }
      sessionSets.get(key)!.add(entry.conversationId);
      bucket.turns += 1;
      bucket.uncachedInputTokens += turn.uncachedInputTokens;
      bucket.cacheReadTokens += turn.cacheReadTokens;
      bucket.totalInputTokens += turn.totalInputTokens;
      bucket.outputTokens += turn.outputTokens;
    }
  }

  const daily: DailyUsageSummary[] = [];
  const totalSessionsSet = new Set<string>();
  let totalTurns = 0;
  let totalUncached = 0;
  let totalCached = 0;
  let totalInput = 0;
  let totalOutput = 0;

  for (const [key, bucket] of bucketMap.entries()) {
    const daySessions = sessionSets.get(key)!;
    bucket.sessions = daySessions.size;
    bucket.cacheHitRate = bucket.totalInputTokens > 0 ? bucket.cacheReadTokens / bucket.totalInputTokens : 0;
    daily.push(bucket);

    for (const id of daySessions) {
      totalSessionsSet.add(id);
    }
    totalTurns += bucket.turns;
    totalUncached += bucket.uncachedInputTokens;
    totalCached += bucket.cacheReadTokens;
    totalInput += bucket.totalInputTokens;
    totalOutput += bucket.outputTokens;
  }

  return {
    days,
    daily,
    totals: {
      sessions: totalSessionsSet.size,
      turns: totalTurns,
      uncachedInputTokens: totalUncached,
      cacheReadTokens: totalCached,
      totalInputTokens: totalInput,
      outputTokens: totalOutput,
      cacheHitRate: totalInput > 0 ? totalCached / totalInput : 0
    }
  };
}
