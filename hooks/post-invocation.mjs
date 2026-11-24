// src/hooks/post-invocation.ts
import fs3 from "node:fs";
import path4 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/core/paths.ts
import os from "node:os";
import path from "node:path";
var PLUGIN_DATA_FOLDER = "agy-context-studio";
function resolveHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}
function resolveAntigravityHome(overrideHome) {
  if (overrideHome && overrideHome.trim().length > 0) {
    return path.resolve(overrideHome);
  }
  const envHome = process.env.ANTIGRAVITY_HOME;
  if (envHome && envHome.trim().length > 0) {
    return path.resolve(envHome);
  }
  return path.join(resolveHomeDir(), ".gemini", "antigravity");
}
function resolvePluginDataDir(overrideDir) {
  if (overrideDir && overrideDir.trim().length > 0) {
    return path.resolve(overrideDir);
  }
  const envDir = process.env.AGY_CONTEXT_STUDIO_DATA || process.env.PLUGIN_DATA;
  if (envDir && envDir.trim().length > 0) {
    return path.resolve(envDir);
  }
  return path.join(resolveHomeDir(), ".gemini", "config", "plugin-data", PLUGIN_DATA_FOLDER);
}
function resolveTranscriptPath(conversationId, antigravityHome) {
  const safeId = path.basename(conversationId.trim());
  return path.join(
    resolveAntigravityHome(antigravityHome),
    "brain",
    safeId,
    ".system_generated",
    "logs",
    "transcript.jsonl"
  );
}

// src/core/configStore.ts
import fs from "node:fs/promises";
import path2 from "node:path";
var DEFAULT_PLUGIN_CONFIG = {
  language: "en",
  hookEnabled: true,
  warningThresholdPct: 70,
  criticalThresholdPct: 85,
  modelOverrides: {}
};
var CONFIG_FILE = "config.json";
var HOOK_STATE_FILE = "hook-state.json";
function clampThreshold(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(99, Math.max(10, Math.round(value)));
}
function normalizeLanguage(value, fallback) {
  return value === "tr" || value === "en" ? value : fallback;
}
function normalizeOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const normalized = {};
  for (const [key, value] of Object.entries(raw)) {
    const trimmedKey = key.trim();
    if (!trimmedKey || !value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const candidate = value;
    const limit = candidate.contextLimit;
    if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
      continue;
    }
    const entry = {
      contextLimit: Math.round(limit)
    };
    if (typeof candidate.compactionThresholdPct === "number" && Number.isFinite(candidate.compactionThresholdPct) && candidate.compactionThresholdPct > 0 && candidate.compactionThresholdPct <= 100) {
      entry.compactionThresholdPct = Math.round(candidate.compactionThresholdPct);
    }
    normalized[trimmedKey] = entry;
  }
  return normalized;
}
function sanitizePluginConfig(raw, base = DEFAULT_PLUGIN_CONFIG) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...base, modelOverrides: { ...base.modelOverrides } };
  }
  const input = raw;
  const warningThresholdPct = clampThreshold(input.warningThresholdPct, base.warningThresholdPct);
  let criticalThresholdPct = clampThreshold(input.criticalThresholdPct, base.criticalThresholdPct);
  if (criticalThresholdPct <= warningThresholdPct) {
    criticalThresholdPct = Math.min(99, warningThresholdPct + 5);
  }
  return {
    language: normalizeLanguage(input.language, base.language),
    hookEnabled: typeof input.hookEnabled === "boolean" ? input.hookEnabled : base.hookEnabled,
    warningThresholdPct,
    criticalThresholdPct,
    modelOverrides: input.modelOverrides !== void 0 ? normalizeOverrides(input.modelOverrides) : { ...base.modelOverrides }
  };
}
async function writeJsonAtomic(filePath, payload) {
  const dir = path2.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}
`, "utf8");
  await fs.rename(tempPath, filePath);
}
async function readPluginConfig(dataDir) {
  const configPath = path2.join(resolvePluginDataDir(dataDir), CONFIG_FILE);
  try {
    const rawText = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(rawText);
    return sanitizePluginConfig(parsed, DEFAULT_PLUGIN_CONFIG);
  } catch {
    return sanitizePluginConfig({}, DEFAULT_PLUGIN_CONFIG);
  }
}
async function readHookState(dataDir) {
  const statePath = path2.join(resolvePluginDataDir(dataDir), HOOK_STATE_FILE);
  try {
    const rawText = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || !parsed.sessions || typeof parsed.sessions !== "object") {
      return { sessions: {} };
    }
    return { sessions: parsed.sessions };
  } catch {
    return { sessions: {} };
  }
}
async function writeHookState(state, dataDir) {
  const statePath = path2.join(resolvePluginDataDir(dataDir), HOOK_STATE_FILE);
  await writeJsonAtomic(statePath, state);
}

// src/core/modelRegistry.ts
var MODEL_LIMIT_CATALOG = [
  { pattern: "gemini-4-neon", contextLimit: 1e6, compactionThresholdPct: 80 },
  { pattern: "gemini-4", contextLimit: 1e6, compactionThresholdPct: 80 },
  { pattern: "gemini-3.5", contextLimit: 1e6, compactionThresholdPct: 80 },
  { pattern: "gemini-3", contextLimit: 1e6, compactionThresholdPct: 80 },
  { pattern: "gemini-2.5-pro", contextLimit: 1e6, compactionThresholdPct: 80 },
  { pattern: "gemini-2.5-flash", contextLimit: 1e6, compactionThresholdPct: 80 },
  { pattern: "gemini-2.0", contextLimit: 1e6, compactionThresholdPct: 80 },
  { pattern: "claude-opus-4", contextLimit: 2e5, compactionThresholdPct: 85 },
  { pattern: "claude-sonnet-4", contextLimit: 2e5, compactionThresholdPct: 85 },
  { pattern: "claude-3-7-sonnet", contextLimit: 2e5, compactionThresholdPct: 85 },
  { pattern: "claude-3-5-sonnet", contextLimit: 2e5, compactionThresholdPct: 85 },
  { pattern: "claude-3-5-haiku", contextLimit: 2e5, compactionThresholdPct: 85 },
  { pattern: "gpt-5", contextLimit: 4e5, compactionThresholdPct: 85 },
  { pattern: "gpt-4.1", contextLimit: 1e6, compactionThresholdPct: 85 },
  { pattern: "gpt-4o", contextLimit: 128e3, compactionThresholdPct: 85 },
  { pattern: "o4-mini", contextLimit: 2e5, compactionThresholdPct: 85 },
  { pattern: "o3", contextLimit: 2e5, compactionThresholdPct: 85 }
];
function normalizeModelId(modelId) {
  return modelId.trim().toLowerCase().replace(/^models\//, "");
}
function resolveModelLimit(modelId, overrides) {
  if (!modelId || modelId.trim().length === 0) {
    return {
      modelId: null,
      matchedPattern: null,
      contextLimit: null,
      compactionThresholdPct: null,
      source: "unknown"
    };
  }
  const normalized = normalizeModelId(modelId);
  if (overrides) {
    for (const [pattern, override] of Object.entries(overrides)) {
      if (normalizeModelId(pattern) === normalized && override.contextLimit > 0) {
        return {
          modelId,
          matchedPattern: pattern,
          contextLimit: override.contextLimit,
          compactionThresholdPct: override.compactionThresholdPct ?? 85,
          source: "override"
        };
      }
    }
    const sortedOverrides = Object.entries(overrides).filter(([, override]) => override && override.contextLimit > 0).sort(([a], [b]) => b.length - a.length);
    for (const [pattern, override] of sortedOverrides) {
      if (normalized.startsWith(normalizeModelId(pattern))) {
        return {
          modelId,
          matchedPattern: pattern,
          contextLimit: override.contextLimit,
          compactionThresholdPct: override.compactionThresholdPct ?? 85,
          source: "override"
        };
      }
    }
  }
  const sortedCatalog = [...MODEL_LIMIT_CATALOG].sort((a, b) => b.pattern.length - a.pattern.length);
  for (const entry of sortedCatalog) {
    if (normalized === entry.pattern || normalized.startsWith(entry.pattern)) {
      return {
        modelId,
        matchedPattern: entry.pattern,
        contextLimit: entry.contextLimit,
        compactionThresholdPct: entry.compactionThresholdPct,
        source: "catalog"
      };
    }
  }
  return {
    modelId,
    matchedPattern: null,
    contextLimit: null,
    compactionThresholdPct: null,
    source: "unknown"
  };
}

// src/core/transcriptParser.ts
import fs2 from "node:fs/promises";
import path3 from "node:path";
import { fileURLToPath } from "node:url";
function createEmptyState(filePath) {
  return {
    filePath,
    byteOffset: 0,
    model: null,
    latestTurn: null,
    turns: [],
    steps: [],
    subagentRefs: [],
    cumulativeUncachedInputTokens: 0,
    cumulativeCacheReadTokens: 0,
    cumulativeTotalInputTokens: 0,
    cumulativeOutputTokens: 0,
    cumulativeCacheHitRate: 0,
    turnCount: 0,
    compactionCount: 0,
    velocityTokensPerTurn: null,
    firstTimestamp: null,
    lastTimestamp: null
  };
}
function createInitialCursor(filePath) {
  return {
    byteOffset: 0,
    fileSize: 0,
    mtimeMs: 0,
    state: createEmptyState(filePath),
    seenSubagentIds: /* @__PURE__ */ new Set()
  };
}
function toFiniteNonNegative(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}
function utf8Bytes(value) {
  if (typeof value !== "string" || value.length === 0) {
    return 0;
  }
  return Buffer.byteLength(value, "utf8");
}
function sanitizeLabel(text, fallback) {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (!singleLine) {
    return fallback;
  }
  if (singleLine.length <= 72) {
    return singleLine;
  }
  return `${singleLine.slice(0, 69)}...`;
}
function extractToolTarget(args) {
  if (!args) {
    return null;
  }
  for (const key of ["Path", "path", "file_path", "TargetFile"]) {
    const val = args[key];
    if (typeof val === "string" && val.trim().length > 0) {
      const unquoted = val.trim().replace(/^["']+|["']+$/g, "");
      const normalized = unquoted.replace(/\\/g, "/");
      const base = normalized.split("/").filter(Boolean).pop();
      if (base) {
        const cleanBase = base.replace(/^["']+|["']+$/g, "");
        return cleanBase.length > 28 ? `${cleanBase.slice(0, 25)}...` : cleanBase;
      }
    }
  }
  const cmd = args.CommandLine ?? args.command;
  if (typeof cmd === "string" && cmd.trim().length > 0) {
    const clean = cmd.replace(/\s+/g, " ").trim();
    return clean.length > 28 ? `${clean.slice(0, 25)}...` : clean;
  }
  return null;
}
function summarizeToolCalls(toolCalls) {
  const counts = /* @__PURE__ */ new Map();
  const targetSet = /* @__PURE__ */ new Set();
  for (const call of toolCalls) {
    const name = typeof call?.name === "string" && call.name.trim() ? call.name.trim() : "tool_call";
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (targetSet.size < 2) {
      const target = extractToolTarget(call?.args);
      if (target) {
        targetSet.add(target);
      }
    }
  }
  const toolCounts = [...counts.entries()].map(([name, count]) => ({
    name,
    count
  }));
  const primaryToolName = toolCounts[0]?.name ?? "tool_call";
  const targets = [...targetSet];
  const countsText = toolCounts.map((item) => item.count > 1 ? `${item.name} \xD7${item.count}` : item.name).join(", ");
  const summaryText = targets.length > 0 ? `${countsText} (${targets.join(", ")})` : countsText;
  return { primaryToolName, toolCounts, targets, summaryText };
}
function uriToFilePath(uri) {
  if (!uri.startsWith("file://")) {
    return void 0;
  }
  try {
    return path3.normalize(fileURLToPath(uri));
  } catch {
    return void 0;
  }
}
function extractSubagentFromContent(content, isInvokeSubagentContext) {
  if (!isInvokeSubagentContext && !content.includes("Created the following subagent")) {
    return null;
  }
  if (!content.includes('"conversationId"')) {
    return null;
  }
  const startIdx = content.indexOf("{");
  const endIdx = content.lastIndexOf("}");
  if (startIdx !== -1 && endIdx > startIdx) {
    const maybeJson = content.slice(startIdx, endIdx + 1);
    try {
      const parsed = JSON.parse(maybeJson);
      if (typeof parsed.conversationId === "string" && parsed.conversationId.trim().length > 0) {
        const transcriptPath = typeof parsed.logAbsoluteUri === "string" ? uriToFilePath(parsed.logAbsoluteUri) : void 0;
        return {
          conversationId: parsed.conversationId.trim(),
          transcriptPath
        };
      }
    } catch {
    }
  }
  const match = content.match(/"conversationId"\s*:\s*"([0-9a-fA-F-]+)"/);
  if (match && match[1]) {
    const uriMatch = content.match(/"logAbsoluteUri"\s*:\s*"([^"]+)"/);
    return {
      conversationId: match[1],
      transcriptPath: uriMatch && uriMatch[1] ? uriToFilePath(uriMatch[1]) : void 0
    };
  }
  return null;
}
function computeVelocity(turns) {
  if (turns.length < 2) {
    return null;
  }
  let windowStartIdx = 0;
  for (let i = 1; i < turns.length; i += 1) {
    const prev = turns[i - 1];
    const curr = turns[i];
    const drop = prev.totalInputTokens - curr.totalInputTokens;
    if (prev.totalInputTokens > 0 && drop > 5e3 && drop / prev.totalInputTokens > 0.2) {
      windowStartIdx = i;
    }
  }
  const windowTurns = turns.slice(windowStartIdx);
  if (windowTurns.length < 2) {
    return null;
  }
  const first = windowTurns[0];
  const last = windowTurns[windowTurns.length - 1];
  return Math.round((last.totalInputTokens - first.totalInputTokens) / (windowTurns.length - 1));
}
function processParsedStep(cursor, step) {
  const { state } = cursor;
  const stepIndex = typeof step.step_index === "number" ? step.step_index : state.steps.length;
  const createdAt = typeof step.created_at === "string" ? step.created_at : void 0;
  if (createdAt) {
    if (!state.firstTimestamp) {
      state.firstTimestamp = createdAt;
    }
    state.lastTimestamp = createdAt;
  }
  const stepType = step.type ?? "";
  if (stepType === "USER_INPUT") {
    cursor.pendingToolName = void 0;
    cursor.pendingToolCounts = void 0;
    cursor.pendingTargets = void 0;
    cursor.pendingSubagentMeta = void 0;
    const bytes = utf8Bytes(step.content);
    if (bytes > 0) {
      state.steps.push({
        stepIndex,
        category: "user",
        stepKind: "user",
        label: sanitizeLabel(step.content ?? "", `User input #${stepIndex}`),
        bytes,
        createdAt
      });
    }
    return;
  }
  if (stepType === "SYSTEM_MESSAGE" || stepType === "EPHEMERAL_MESSAGE") {
    const bytes = utf8Bytes(step.content);
    if (bytes > 0) {
      state.steps.push({
        stepIndex,
        category: "system",
        stepKind: "system",
        label: `${stepType === "EPHEMERAL_MESSAGE" ? "Ephemeral" : "System"} #${stepIndex}`,
        bytes,
        createdAt
      });
    }
    return;
  }
  if (stepType === "PLANNER_RESPONSE") {
    cursor.pendingToolName = void 0;
    cursor.pendingToolCounts = void 0;
    cursor.pendingTargets = void 0;
    cursor.pendingSubagentMeta = void 0;
    if (typeof step.model === "string" && step.model.trim().length > 0) {
      state.model = step.model.trim();
    }
    const uncachedInputTokens = toFiniteNonNegative(step.input_tokens);
    const cacheReadTokens = toFiniteNonNegative(step.cache_read_tokens);
    const totalInputTokens = uncachedInputTokens + cacheReadTokens;
    const outputTokens = toFiniteNonNegative(step.output_tokens);
    const turnCacheHitRate = totalInputTokens > 0 ? cacheReadTokens / totalInputTokens : 0;
    const prevTurn = state.latestTurn;
    if (prevTurn && prevTurn.totalInputTokens > 0) {
      const drop = prevTurn.totalInputTokens - totalInputTokens;
      if (drop > 5e3 && drop / prevTurn.totalInputTokens > 0.2) {
        state.compactionCount += 1;
      }
    }
    const turn = {
      stepIndex,
      model: state.model ?? void 0,
      uncachedInputTokens,
      cacheReadTokens,
      totalInputTokens,
      outputTokens,
      turnCacheHitRate,
      createdAt
    };
    state.turns.push(turn);
    state.latestTurn = turn;
    state.turnCount += 1;
    state.cumulativeUncachedInputTokens += uncachedInputTokens;
    state.cumulativeCacheReadTokens += cacheReadTokens;
    state.cumulativeTotalInputTokens += totalInputTokens;
    state.cumulativeOutputTokens += outputTokens;
    state.cumulativeCacheHitRate = state.cumulativeTotalInputTokens > 0 ? state.cumulativeCacheReadTokens / state.cumulativeTotalInputTokens : 0;
    state.velocityTokensPerTurn = computeVelocity(state.turns);
    const thinkingBytes = utf8Bytes(step.thinking);
    if (thinkingBytes > 0) {
      state.steps.push({
        stepIndex,
        category: "thinking",
        stepKind: "thinking",
        label: `Thinking #${stepIndex}`,
        bytes: thinkingBytes,
        createdAt
      });
    }
    const contentBytes = utf8Bytes(step.content);
    if (contentBytes > 0) {
      state.steps.push({
        stepIndex,
        category: "assistant",
        stepKind: "assistant",
        label: sanitizeLabel(step.content ?? "", `Assistant reply #${stepIndex}`),
        bytes: contentBytes,
        createdAt
      });
    }
    if (Array.isArray(step.tool_calls) && step.tool_calls.length > 0) {
      const summary = summarizeToolCalls(step.tool_calls);
      cursor.pendingToolName = summary.summaryText;
      cursor.pendingToolCounts = summary.toolCounts;
      cursor.pendingTargets = summary.targets;
      const subagentCall = step.tool_calls.find((call) => call?.name === "invoke_subagent");
      if (subagentCall) {
        const args = subagentCall.args ?? {};
        cursor.pendingSubagentMeta = {
          role: typeof args.Role === "string" ? args.Role : void 0,
          typeName: typeof args.TypeName === "string" ? args.TypeName : void 0,
          stepIndex
        };
      }
      const serializedCalls = JSON.stringify(step.tool_calls);
      const callBytes = Buffer.byteLength(serializedCalls, "utf8");
      if (callBytes > 0) {
        state.steps.push({
          stepIndex,
          category: "tools",
          stepKind: "tool_call",
          label: summary.summaryText,
          toolName: summary.primaryToolName,
          toolCounts: summary.toolCounts,
          targets: summary.targets,
          bytes: callBytes,
          createdAt
        });
      }
    }
    return;
  }
  if (stepType === "GENERIC") {
    const content = typeof step.content === "string" ? step.content : "";
    const bytes = utf8Bytes(content);
    const toolLabel = cursor.pendingToolName ? cursor.pendingToolName : `Tool output #${stepIndex}`;
    if (bytes > 0) {
      state.steps.push({
        stepIndex,
        category: "tools",
        stepKind: "tool_result",
        label: toolLabel,
        toolName: cursor.pendingToolCounts?.[0]?.name ?? cursor.pendingToolName,
        toolCounts: cursor.pendingToolCounts,
        targets: cursor.pendingTargets,
        bytes,
        createdAt
      });
    }
    const extracted = extractSubagentFromContent(content, Boolean(cursor.pendingSubagentMeta));
    if (extracted && !cursor.seenSubagentIds.has(extracted.conversationId)) {
      cursor.seenSubagentIds.add(extracted.conversationId);
      const ref = {
        conversationId: extracted.conversationId,
        transcriptPath: extracted.transcriptPath,
        role: cursor.pendingSubagentMeta?.role,
        typeName: cursor.pendingSubagentMeta?.typeName,
        spawnedAtStep: cursor.pendingSubagentMeta?.stepIndex ?? stepIndex,
        createdAt
      };
      state.subagentRefs.push(ref);
      cursor.pendingSubagentMeta = void 0;
    }
    return;
  }
  const fallbackBytes = utf8Bytes(step.content);
  if (fallbackBytes > 0) {
    state.steps.push({
      stepIndex,
      category: step.source === "USER_EXPLICIT" ? "user" : "system",
      label: sanitizeLabel(step.content ?? "", `Step #${stepIndex}`),
      bytes: fallbackBytes,
      createdAt
    });
  }
}
var IncrementalTranscriptReader = class {
  cursors = /* @__PURE__ */ new Map();
  clear(filePath) {
    if (filePath) {
      this.cursors.delete(path3.resolve(filePath));
    } else {
      this.cursors.clear();
    }
  }
  async readIncremental(filePath) {
    const resolvedPath = path3.resolve(filePath);
    let stat;
    try {
      stat = await fs2.stat(resolvedPath);
    } catch {
      this.cursors.delete(resolvedPath);
      return null;
    }
    let cursor = this.cursors.get(resolvedPath);
    if (!cursor) {
      cursor = createInitialCursor(resolvedPath);
      this.cursors.set(resolvedPath, cursor);
    }
    if (stat.size === cursor.fileSize && stat.mtimeMs === cursor.mtimeMs) {
      return cursor.state;
    }
    if (stat.size < cursor.byteOffset) {
      cursor = createInitialCursor(resolvedPath);
      this.cursors.set(resolvedPath, cursor);
    }
    const bytesToRead = stat.size - cursor.byteOffset;
    if (bytesToRead <= 0) {
      cursor.fileSize = stat.size;
      cursor.mtimeMs = stat.mtimeMs;
      return cursor.state;
    }
    const handle = await fs2.open(resolvedPath, "r");
    try {
      const buffer = Buffer.allocUnsafe(bytesToRead);
      let totalRead = 0;
      while (totalRead < bytesToRead) {
        const { bytesRead } = await handle.read(
          buffer,
          totalRead,
          bytesToRead - totalRead,
          cursor.byteOffset + totalRead
        );
        if (bytesRead === 0) {
          break;
        }
        totalRead += bytesRead;
      }
      const slice = buffer.subarray(0, totalRead);
      const lastNewlineIdx = slice.lastIndexOf(10);
      if (lastNewlineIdx === -1) {
        cursor.fileSize = stat.size;
        cursor.mtimeMs = stat.mtimeMs;
        return cursor.state;
      }
      const completeBytes = lastNewlineIdx + 1;
      const chunkText = slice.subarray(0, completeBytes).toString("utf8");
      const lines = chunkText.split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }
        try {
          const parsed = JSON.parse(line);
          if (parsed && typeof parsed === "object") {
            processParsedStep(cursor, parsed);
          }
        } catch {
        }
      }
      cursor.byteOffset += completeBytes;
      cursor.fileSize = stat.size;
      cursor.mtimeMs = stat.mtimeMs;
      cursor.state.byteOffset = cursor.byteOffset;
      return cursor.state;
    } finally {
      await handle.close();
    }
  }
};

// src/core/estimator.ts
var CATEGORY_ORDER = ["user", "assistant", "thinking", "tools", "system"];
function estimateCategoryBreakdown(steps, totalInputTokens) {
  const byteTotals = {
    user: 0,
    assistant: 0,
    thinking: 0,
    tools: 0,
    system: 0
  };
  let totalBytes = 0;
  for (const step of steps) {
    const bytes = typeof step.bytes === "number" && Number.isFinite(step.bytes) && step.bytes > 0 ? step.bytes : 0;
    byteTotals[step.category] += bytes;
    totalBytes += bytes;
  }
  const safeTokens = typeof totalInputTokens === "number" && Number.isFinite(totalInputTokens) && totalInputTokens > 0 ? totalInputTokens : 0;
  const categories = CATEGORY_ORDER.map((category) => {
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
function rankTopBloaters(steps, totalInputTokens, limit = 10) {
  if (!Array.isArray(steps) || steps.length === 0 || limit <= 0) {
    return [];
  }
  let totalBytes = 0;
  for (const step of steps) {
    if (typeof step.bytes === "number" && Number.isFinite(step.bytes) && step.bytes > 0) {
      totalBytes += step.bytes;
    }
  }
  if (totalBytes <= 0) {
    return [];
  }
  const safeTokens = typeof totalInputTokens === "number" && Number.isFinite(totalInputTokens) && totalInputTokens > 0 ? totalInputTokens : 0;
  const sorted = [...steps].filter((step) => typeof step.bytes === "number" && Number.isFinite(step.bytes) && step.bytes > 0).sort((a, b) => b.bytes - a.bytes).slice(0, limit);
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

// src/core/subagentAggregator.ts
async function aggregateSubagents(refs, reader, options = {}) {
  const maxDepth = options.maxDepth ?? 3;
  const depth = options.depth ?? 0;
  const visited = options.visited ?? /* @__PURE__ */ new Set();
  if (depth >= maxDepth || refs.length === 0) {
    return [];
  }
  const summaries = [];
  for (const ref of refs) {
    if (visited.has(ref.conversationId)) {
      continue;
    }
    visited.add(ref.conversationId);
    const transcriptPath = ref.transcriptPath ?? resolveTranscriptPath(ref.conversationId, options.antigravityHome);
    const parsed = await reader.readIncremental(transcriptPath);
    if (!parsed) {
      summaries.push({
        conversationId: ref.conversationId,
        transcriptPath,
        role: ref.role,
        typeName: ref.typeName,
        status: "missing",
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
    const children = parsed.subagentRefs.length > 0 ? await aggregateSubagents(parsed.subagentRefs, reader, {
      antigravityHome: options.antigravityHome,
      maxDepth,
      visited,
      depth: depth + 1
    }) : [];
    summaries.push({
      conversationId: ref.conversationId,
      transcriptPath,
      role: ref.role,
      typeName: ref.typeName,
      status: "active",
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

// src/core/snapshotBuilder.ts
async function buildContextSnapshot(conversationId, options = {}) {
  const reader = options.reader ?? new IncrementalTranscriptReader();
  const config = options.config ?? await readPluginConfig(options.pluginDataDir);
  const transcriptPath = options.transcriptPath ?? resolveTranscriptPath(conversationId, options.antigravityHome);
  const parsed = await reader.readIncremental(transcriptPath);
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (!parsed) {
    const emptyLimit = resolveModelLimit(null, config.modelOverrides);
    return {
      schemaVersion: 1,
      conversationId,
      transcriptPath,
      status: "missing",
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
  const usagePct = modelLimit.contextLimit && modelLimit.contextLimit > 0 ? Number((totalInputTokens / modelLimit.contextLimit * 100).toFixed(2)) : null;
  const subagents = await aggregateSubagents(parsed.subagentRefs, reader, {
    antigravityHome: options.antigravityHome,
    visited: /* @__PURE__ */ new Set([conversationId])
  });
  return {
    schemaVersion: 1,
    conversationId,
    transcriptPath,
    status: parsed.turnCount === 0 && parsed.steps.length === 0 ? "empty" : "ok",
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

// src/hooks/evaluator.ts
function formatNum(n) {
  return Math.round(n).toLocaleString("en-US");
}
function formatAlertMarkdown(level, snapshot, lang) {
  const pctText = snapshot.usagePct !== null ? `${snapshot.usagePct.toFixed(1)}%` : "-";
  const limitText = snapshot.modelLimit.contextLimit ? formatNum(snapshot.modelLimit.contextLimit) : "-";
  const usedText = formatNum(snapshot.totalInputTokens);
  const cachePct = `${(snapshot.turnCacheHitRate * 100).toFixed(1)}%`;
  const topBloater = snapshot.topBloaters[0];
  if (lang === "tr") {
    const heading2 = level === "critical" ? `**Context Studio \u2014 Kritik Ba\u011Flam E\u015Fi\u011Fi (${pctText})**` : `**Context Studio \u2014 Ba\u011Flam Uyar\u0131s\u0131 (${pctText})**`;
    const lines2 = [
      heading2,
      `- Doluluk: \`${usedText} / ${limitText}\` token (\`${snapshot.model ?? "-"}\`) \xB7 Tur \xF6nbellek isabeti: \`${cachePct}\``
    ];
    if (topBloater) {
      lines2.push(
        `- En b\xFCy\xFCk ad\u0131m (~tahmini): \`${topBloater.label}\` (~${formatNum(topBloater.estimatedTokens)} token)`
      );
    }
    lines2.push(
      level === "critical" ? "- \xD6neri: Context Studio \xFCzerinden **Ak\u0131ll\u0131 Devir** ba\u015Flat\u0131n veya `/compact` \xE7al\u0131\u015Ft\u0131r\u0131n." : "- \xD6neri: Context Studio yan panelinden b\xFCy\xFCk ad\u0131mlar\u0131 kontrol edin veya \xF6zet noktas\u0131 al\u0131n."
    );
    return lines2.join("\n");
  }
  const heading = level === "critical" ? `**Context Studio \u2014 Critical Context Threshold (${pctText})**` : `**Context Studio \u2014 Context Warning (${pctText})**`;
  const lines = [
    heading,
    `- Fill: \`${usedText} / ${limitText}\` tokens (\`${snapshot.model ?? "-"}\`) \xB7 Turn cache hit: \`${cachePct}\``
  ];
  if (topBloater) {
    lines.push(
      `- Largest step (~estimate): \`${topBloater.label}\` (~${formatNum(topBloater.estimatedTokens)} tokens)`
    );
  }
  lines.push(
    level === "critical" ? "- Next step: Trigger **Smart Handoff** in Context Studio or run `/compact`." : "- Next step: Inspect top bloaters in the Context Studio sidecar or create a checkpoint."
  );
  return lines.join("\n");
}
function evaluateThresholdAlert(snapshot, config, prevSessionState, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  const prevLevel = prevSessionState?.lastWarnedLevel ?? "none";
  if (!config.hookEnabled || snapshot.status === "missing" || snapshot.usagePct === null) {
    return {
      shouldNotify: false,
      level: "none",
      nextSessionState: {
        lastWarnedLevel: prevLevel,
        lastInputTokens: snapshot.totalInputTokens,
        lastUpdatedAt: nowIso
      },
      output: {}
    };
  }
  let level = "none";
  if (snapshot.usagePct >= config.criticalThresholdPct) {
    level = "critical";
  } else if (snapshot.usagePct >= config.warningThresholdPct) {
    level = "warning";
  }
  if (level === "none") {
    return {
      shouldNotify: false,
      level: "none",
      nextSessionState: {
        lastWarnedLevel: "none",
        lastInputTokens: snapshot.totalInputTokens,
        lastUpdatedAt: nowIso
      },
      output: {}
    };
  }
  const alreadyNotified = level === "warning" && (prevLevel === "warning" || prevLevel === "critical") || level === "critical" && prevLevel === "critical";
  if (alreadyNotified) {
    return {
      shouldNotify: false,
      level,
      nextSessionState: {
        lastWarnedLevel: prevLevel,
        lastInputTokens: snapshot.totalInputTokens,
        lastUpdatedAt: nowIso
      },
      output: {}
    };
  }
  const markdown = formatAlertMarkdown(level, snapshot, config.language);
  return {
    shouldNotify: true,
    level,
    nextSessionState: {
      lastWarnedLevel: level,
      lastInputTokens: snapshot.totalInputTokens,
      lastUpdatedAt: nowIso
    },
    output: {
      injectSteps: [
        {
          systemMessage: {
            systemMessage: "",
            metadata: {
              user_markdown: markdown
            }
          }
        }
      ]
    }
  };
}

// src/hooks/post-invocation.ts
async function runPostInvocationHook(rawInput, options = {}) {
  let payload;
  try {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return {};
    }
    payload = JSON.parse(trimmed);
  } catch {
    return {};
  }
  const conversationId = typeof payload.conversationId === "string" && payload.conversationId.trim().length > 0 ? payload.conversationId.trim() : "";
  const transcriptPath = typeof payload.transcriptPath === "string" && payload.transcriptPath.trim().length > 0 ? payload.transcriptPath.trim() : void 0;
  if (!conversationId && !transcriptPath) {
    return {};
  }
  const [config, hookState] = await Promise.all([
    readPluginConfig(options.pluginDataDir),
    readHookState(options.pluginDataDir)
  ]);
  const sessionKey = conversationId || transcriptPath || "default";
  const snapshot = await buildContextSnapshot(conversationId || sessionKey, {
    antigravityHome: options.antigravityHome,
    pluginDataDir: options.pluginDataDir,
    transcriptPath,
    config
  });
  const evaluation = evaluateThresholdAlert(
    snapshot,
    config,
    hookState.sessions[sessionKey]
  );
  hookState.sessions[sessionKey] = evaluation.nextSessionState;
  await writeHookState(hookState, options.pluginDataDir);
  return evaluation.output;
}
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
function isDirectEntryModule() {
  if (typeof process.argv[1] !== "string" || process.argv[1].trim().length === 0) {
    return false;
  }
  try {
    return fs3.realpathSync(fileURLToPath2(import.meta.url)) === fs3.realpathSync(path4.resolve(process.argv[1]));
  } catch {
    return path4.resolve(fileURLToPath2(import.meta.url)) === path4.resolve(process.argv[1]);
  }
}
if (isDirectEntryModule()) {
  readStdin().then((stdinText) => runPostInvocationHook(stdinText)).then((output) => {
    process.stdout.write(`${JSON.stringify(output)}
`);
  }).catch(() => {
    process.stdout.write("{}\n");
  });
}
export {
  runPostInvocationHook
};
