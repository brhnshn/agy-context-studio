export type LanguageCode = 'en' | 'tr';

export type CategoryKey = 'user' | 'assistant' | 'thinking' | 'tools' | 'system';

export interface ToolCallInvocation {
  name: string;
  args?: Record<string, unknown>;
}

export interface RawTranscriptStep {
  step_index?: number;
  source?: string;
  type?: string;
  status?: string;
  created_at?: string;
  model?: string;
  input_tokens?: number;
  cache_read_tokens?: number;
  output_tokens?: number;
  thinking?: string;
  content?: string;
  tool_calls?: Array<{
    name?: string;
    args?: Record<string, unknown>;
  }>;
}

export interface ParsedStepSummary {
  stepIndex: number;
  category: CategoryKey;
  label: string;
  toolName?: string;
  bytes: number;
  createdAt?: string;
}

export interface TurnTelemetry {
  stepIndex: number;
  model?: string;
  uncachedInputTokens: number;
  cacheReadTokens: number;
  totalInputTokens: number;
  outputTokens: number;
  turnCacheHitRate: number;
  createdAt?: string;
}

export interface SubagentRef {
  conversationId: string;
  transcriptPath?: string;
  role?: string;
  typeName?: string;
  spawnedAtStep: number;
  createdAt?: string;
}

export interface ParsedTranscriptState {
  filePath: string;
  byteOffset: number;
  model: string | null;
  latestTurn: TurnTelemetry | null;
  turns: TurnTelemetry[];
  steps: ParsedStepSummary[];
  subagentRefs: SubagentRef[];
  cumulativeUncachedInputTokens: number;
  cumulativeCacheReadTokens: number;
  cumulativeTotalInputTokens: number;
  cumulativeOutputTokens: number;
  cumulativeCacheHitRate: number;
  turnCount: number;
  compactionCount: number;
  velocityTokensPerTurn: number | null;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
}

export interface ModelOverride {
  contextLimit: number;
  compactionThresholdPct?: number;
}

export interface ModelLimitInfo {
  modelId: string | null;
  matchedPattern: string | null;
  contextLimit: number | null;
  compactionThresholdPct: number | null;
  source: 'override' | 'catalog' | 'unknown';
}

export interface CategorySlice {
  category: CategoryKey;
  bytes: number;
  estimatedTokens: number;
  sharePct: number;
}

export interface CategoryBreakdown {
  isEstimate: true;
  totalBytes: number;
  categories: CategorySlice[];
}

export interface BloaterItem {
  stepIndex: number;
  category: CategoryKey;
  label: string;
  toolName?: string;
  bytes: number;
  estimatedTokens: number;
  sharePct: number;
  createdAt?: string;
}

export interface SubagentSummary {
  conversationId: string;
  transcriptPath: string;
  role?: string;
  typeName?: string;
  status: 'active' | 'missing';
  model: string | null;
  totalInputTokens: number;
  uncachedInputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  cacheHitRate: number;
  turnCount: number;
  lastTimestamp: string | null;
  children: SubagentSummary[];
}

export interface ContextSnapshot {
  schemaVersion: 1;
  conversationId: string;
  transcriptPath: string;
  status: 'ok' | 'empty' | 'missing';
  model: string | null;
  modelLimit: ModelLimitInfo;
  uncachedInputTokens: number;
  cacheReadTokens: number;
  totalInputTokens: number;
  outputTokens: number;
  turnCacheHitRate: number;
  cumulativeUncachedInputTokens: number;
  cumulativeCacheReadTokens: number;
  cumulativeTotalInputTokens: number;
  cumulativeOutputTokens: number;
  cumulativeCacheHitRate: number;
  usagePct: number | null;
  compactionPct: number | null;
  turnCount: number;
  compactionCount: number;
  velocityTokensPerTurn: number | null;
  breakdown: CategoryBreakdown;
  topBloaters: BloaterItem[];
  subagents: SubagentSummary[];
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  updatedAt: string;
}

export interface DailyUsageSummary {
  date: string;
  sessions: number;
  turns: number;
  uncachedInputTokens: number;
  cacheReadTokens: number;
  totalInputTokens: number;
  outputTokens: number;
  cacheHitRate: number;
}

export interface UsageHistory {
  days: number;
  daily: DailyUsageSummary[];
  totals: {
    sessions: number;
    turns: number;
    uncachedInputTokens: number;
    cacheReadTokens: number;
    totalInputTokens: number;
    outputTokens: number;
    cacheHitRate: number;
  };
}

export interface PluginConfig {
  language: LanguageCode;
  hookEnabled: boolean;
  warningThresholdPct: number;
  criticalThresholdPct: number;
  modelOverrides: Record<string, ModelOverride>;
}

export interface HookSessionState {
  lastWarnedLevel: 'none' | 'warning' | 'critical';
  lastInputTokens: number;
  lastUpdatedAt: string;
}

export interface HookStateStore {
  sessions: Record<string, HookSessionState>;
}
