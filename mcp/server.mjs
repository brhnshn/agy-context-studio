// src/mcp/server.ts
import readline from "node:readline";
import { pathToFileURL } from "node:url";

// src/core/paths.ts
import fs from "node:fs/promises";
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
async function listConversationEntries(antigravityHome) {
  const brainDir = path.join(resolveAntigravityHome(antigravityHome), "brain");
  let dirEntries;
  try {
    dirEntries = await fs.readdir(brainDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const results = [];
  for (const entry of dirEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const transcriptPath = path.join(brainDir, entry.name, ".system_generated", "logs", "transcript.jsonl");
    try {
      const stat = await fs.stat(transcriptPath);
      if (stat.isFile()) {
        results.push({
          conversationId: entry.name,
          transcriptPath,
          mtimeMs: stat.mtimeMs
        });
      }
    } catch {
    }
  }
  results.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return results;
}

// src/core/configStore.ts
import fs2 from "node:fs/promises";
import path2 from "node:path";
var DEFAULT_PLUGIN_CONFIG = {
  language: "en",
  hookEnabled: true,
  warningThresholdPct: 70,
  criticalThresholdPct: 85,
  modelOverrides: {}
};
var CONFIG_FILE = "config.json";
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
async function readPluginConfig(dataDir) {
  const configPath = path2.join(resolvePluginDataDir(dataDir), CONFIG_FILE);
  try {
    const rawText = await fs2.readFile(configPath, "utf8");
    const parsed = JSON.parse(rawText);
    return sanitizePluginConfig(parsed, DEFAULT_PLUGIN_CONFIG);
  } catch {
    return sanitizePluginConfig({}, DEFAULT_PLUGIN_CONFIG);
  }
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
import fs3 from "node:fs/promises";
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
      stat = await fs3.stat(resolvedPath);
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
    const handle = await fs3.open(resolvedPath, "r");
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

// src/mcp/cardHtml.ts
var CONTEXT_CARD_URI = "ui://agy-context-studio/card.html";
function renderContextCardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Context Studio Card</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--vscode-editorWidget-background, #161d26);
      --fg: var(--vscode-foreground, #e2e8f0);
      --muted: var(--vscode-descriptionForeground, #94a3b8);
      --border: var(--vscode-panel-border, rgba(148, 163, 184, 0.2));
      --track: rgba(148, 163, 184, 0.14);
      --ok: #10b981;
      --warn: #f59e0b;
      --crit: #ef4444;
      --accent: #38bdf8;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: var(--vscode-editorWidget-background, #ffffff);
        --fg: var(--vscode-foreground, #0f172a);
        --muted: var(--vscode-descriptionForeground, #475569);
        --border: var(--vscode-panel-border, rgba(15, 23, 42, 0.14));
        --track: rgba(15, 23, 42, 0.08);
      }
    }
    body {
      margin: 0;
      padding: 12px;
      background: transparent;
      color: var(--fg);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
    }
    .card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 8px;
    }
    .title {
      font-weight: 600;
      font-size: 13px;
    }
    .muted {
      color: var(--muted);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .bar-track {
      height: 8px;
      border-radius: 999px;
      background: var(--track);
      overflow: hidden;
      margin: 8px 0 10px;
    }
    .bar-fill {
      height: 100%;
      width: 0%;
      background: var(--accent);
      transition: width 180ms ease;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      font-variant-numeric: tabular-nums;
    }
    .stat {
      background: var(--track);
      border-radius: 7px;
      padding: 6px 8px;
    }
    .stat-label {
      font-size: 11px;
      color: var(--muted);
    }
    .stat-val {
      font-size: 13px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="row">
      <span class="title" id="model">Context Studio</span>
      <span class="muted" id="pct">-</span>
    </div>
    <div class="muted" id="tokens">Waiting for telemetry...</div>
    <div class="bar-track"><div class="bar-fill" id="fill"></div></div>
    <div class="grid">
      <div class="stat">
        <div class="stat-label">Turn Cache Hit</div>
        <div class="stat-val" id="cache">-</div>
      </div>
      <div class="stat">
        <div class="stat-label">Turns</div>
        <div class="stat-val" id="turns">-</div>
      </div>
      <div class="stat">
        <div class="stat-label">Compactions</div>
        <div class="stat-val" id="compactions">-</div>
      </div>
    </div>
  </div>
  <script>
    (function () {
      function fmt(n) {
        return typeof n === 'number' && Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '-';
      }
      function render(snap) {
        if (!snap || typeof snap !== 'object') return;
        document.getElementById('model').textContent = snap.model || 'Context Studio';
        var limit = snap.modelLimit && snap.modelLimit.contextLimit ? fmt(snap.modelLimit.contextLimit) : '-';
        document.getElementById('tokens').textContent = fmt(snap.totalInputTokens) + ' / ' + limit + ' tokens';
        var pct = typeof snap.usagePct === 'number' ? snap.usagePct : null;
        document.getElementById('pct').textContent = pct !== null ? pct.toFixed(1) + '%' : '-';
        var fill = document.getElementById('fill');
        fill.style.width = pct !== null ? Math.min(100, Math.max(0, pct)) + '%' : '0%';
        fill.style.background = pct >= 85 ? 'var(--crit)' : pct >= 70 ? 'var(--warn)' : 'var(--ok)';
        var cacheRate = typeof snap.turnCacheHitRate === 'number' ? (snap.turnCacheHitRate * 100).toFixed(1) + '%' : '-';
        document.getElementById('cache').textContent = cacheRate;
        document.getElementById('turns').textContent = fmt(snap.turnCount);
        document.getElementById('compactions').textContent = fmt(snap.compactionCount);
      }

      window.addEventListener('message', function (event) {
        var msg = event.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.method === 'ui/notifications/tool-result' && msg.params) {
          render(msg.params.structuredContent || msg.params);
        }
      });

      window.parent.postMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/initialize',
        params: {
          appInfo: { name: 'Context Studio Card', version: '0.1.0' },
          appCapabilities: {},
          protocolVersion: '2026-01-26'
        }
      }, '*');
    })();
  </script>
</body>
</html>
`;
}

// src/mcp/server.ts
var TOOL_SCHEMA = {
  name: "get_context_health",
  title: "Context Health",
  description: "Inspect exact current context window fill, prompt cache hit rate, top context bloaters, and subagent token totals from local Antigravity transcripts.",
  inputSchema: {
    type: "object",
    properties: {
      conversationId: {
        type: "string",
        description: "Optional conversation ID. Defaults to the most recently updated session."
      }
    }
  },
  _meta: {
    ui: {
      resourceUri: CONTEXT_CARD_URI
    }
  }
};
async function handleMcpRequest(req, options = {}) {
  if (req.id === void 0) {
    return null;
  }
  const id = req.id;
  const pluginDataDir = resolvePluginDataDir(options.pluginDataDir);
  switch (req.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: {
            name: "agy-context-studio",
            version: "0.1.0"
          },
          capabilities: {
            tools: {},
            resources: {}
          }
        }
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: [TOOL_SCHEMA]
        }
      };
    case "tools/call": {
      const params = req.params ?? {};
      const toolName = params.name;
      if (toolName !== "get_context_health") {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${String(toolName)}` }
        };
      }
      const args = params.arguments ?? {};
      let conversationId = typeof args.conversationId === "string" && args.conversationId.trim().length > 0 ? args.conversationId.trim() : "";
      if (!conversationId) {
        const entries = await listConversationEntries(options.antigravityHome);
        conversationId = entries[0]?.conversationId ?? "none";
      }
      const snapshot = await buildContextSnapshot(conversationId, {
        antigravityHome: options.antigravityHome,
        pluginDataDir
      });
      const limitText = snapshot.modelLimit.contextLimit ? snapshot.modelLimit.contextLimit.toLocaleString("en-US") : "unknown";
      const usageText = snapshot.usagePct !== null ? `${snapshot.usagePct.toFixed(1)}%` : "-";
      const cacheText = `${(snapshot.turnCacheHitRate * 100).toFixed(1)}%`;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: [
                `Conversation: ${snapshot.conversationId}`,
                `Model: ${snapshot.model ?? "-"}`,
                `Context Fill: ${snapshot.totalInputTokens.toLocaleString("en-US")} / ${limitText} (${usageText})`,
                `Turn Cache Hit: ${cacheText}`,
                `Turns: ${snapshot.turnCount}, Compactions: ${snapshot.compactionCount}`
              ].join("\n")
            }
          ],
          structuredContent: snapshot
        }
      };
    }
    case "resources/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          resources: [
            {
              uri: CONTEXT_CARD_URI,
              name: "Context Studio Health Card",
              mimeType: "text/html;profile=mcp-app"
            }
          ]
        }
      };
    case "resources/read": {
      const uri = req.params?.uri;
      if (uri !== CONTEXT_CARD_URI) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `Unknown resource URI: ${String(uri)}` }
        };
      }
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri: CONTEXT_CARD_URI,
              mimeType: "text/html;profile=mcp-app",
              text: renderContextCardHtml()
            }
          ]
        }
      };
    }
    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${req.method}` }
      };
  }
}
function startStdioMcpServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    let req;
    try {
      req = JSON.parse(trimmed);
    } catch {
      const errResp = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" }
      };
      process.stdout.write(`${JSON.stringify(errResp)}
`);
      return;
    }
    void handleMcpRequest(req).then((response) => {
      if (response) {
        process.stdout.write(`${JSON.stringify(response)}
`);
      }
    }).catch((error) => {
      if (req.id !== void 0) {
        const errResp = {
          jsonrpc: "2.0",
          id: req.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal error"
          }
        };
        process.stdout.write(`${JSON.stringify(errResp)}
`);
      }
    });
  });
}
var isDirectEntry = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectEntry) {
  startStdioMcpServer();
}
export {
  handleMcpRequest
};
