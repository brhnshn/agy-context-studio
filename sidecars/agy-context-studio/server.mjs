// src/sidecar/server.ts
import http from "node:http";
import path6 from "node:path";
import { fileURLToPath as fileURLToPath2, pathToFileURL } from "node:url";

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
async function writeJsonAtomic(filePath, payload) {
  const dir = path2.dirname(filePath);
  await fs2.mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs2.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}
`, "utf8");
  await fs2.rename(tempPath, filePath);
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
async function writePluginConfig(partial, dataDir) {
  const current = await readPluginConfig(dataDir);
  const next = sanitizePluginConfig(
    {
      ...current,
      ...partial,
      modelOverrides: partial.modelOverrides !== void 0 ? partial.modelOverrides : current.modelOverrides
    },
    current
  );
  const configPath = path2.join(resolvePluginDataDir(dataDir), CONFIG_FILE);
  await writeJsonAtomic(configPath, next);
  return next;
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

// src/core/historyAggregator.ts
function toUtcDateKey(date) {
  return date.toISOString().slice(0, 10);
}
function resolveTurnDateKey(createdAt, fallbackMtimeMs) {
  if (createdAt) {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return toUtcDateKey(parsed);
    }
  }
  return toUtcDateKey(new Date(fallbackMtimeMs));
}
async function aggregateUsageHistory(options = {}) {
  const days = Math.min(30, Math.max(1, Math.round(options.days ?? 7)));
  const now = options.now ?? /* @__PURE__ */ new Date();
  const reader = options.reader ?? new IncrementalTranscriptReader();
  const bucketMap = /* @__PURE__ */ new Map();
  const sessionSets = /* @__PURE__ */ new Map();
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
    sessionSets.set(key, /* @__PURE__ */ new Set());
  }
  const cutoffMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)) - 24 * 60 * 60 * 1e3;
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
      sessionSets.get(key).add(entry.conversationId);
      bucket.turns += 1;
      bucket.uncachedInputTokens += turn.uncachedInputTokens;
      bucket.cacheReadTokens += turn.cacheReadTokens;
      bucket.totalInputTokens += turn.totalInputTokens;
      bucket.outputTokens += turn.outputTokens;
    }
  }
  const daily = [];
  const totalSessionsSet = /* @__PURE__ */ new Set();
  let totalTurns = 0;
  let totalUncached = 0;
  let totalCached = 0;
  let totalInput = 0;
  let totalOutput = 0;
  for (const [key, bucket] of bucketMap.entries()) {
    const daySessions = sessionSets.get(key);
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

// src/sidecar/routes.ts
import fs4 from "node:fs/promises";
import path4 from "node:path";
var MAX_JSON_BODY_BYTES = 64 * 1024;
var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};
function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(payload);
}
async function readJsonBody(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new Error("Request body too large");
    }
    chunks.push(buf);
  }
  const rawText = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawText) {
    return {};
  }
  const parsed = JSON.parse(rawText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON body must be an object");
  }
  return parsed;
}
async function resolveTargetConversationId(queryParam, antigravityHome) {
  if (queryParam && queryParam.trim().length > 0) {
    return queryParam.trim();
  }
  const envConv = process.env.CONVERSATION_ID || process.env.SIDECAR_CONVERSATION_ID;
  if (envConv && envConv.trim().length > 0) {
    return envConv.trim();
  }
  const entries = await listConversationEntries(antigravityHome);
  return entries[0]?.conversationId ?? null;
}
async function serveStaticAsset(res, publicDir, pathname) {
  const resolvedRoot = path4.resolve(publicDir);
  const relativeRequest = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path4.resolve(resolvedRoot, relativeRequest);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${path4.sep}`)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  let targetPath = candidate;
  try {
    const stat = await fs4.stat(targetPath);
    if (stat.isDirectory()) {
      targetPath = path4.join(targetPath, "index.html");
    }
  } catch {
    if (!path4.extname(relativeRequest)) {
      targetPath = path4.join(resolvedRoot, "index.html");
    } else {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
  }
  try {
    const content = await fs4.readFile(targetPath);
    const ext = path4.extname(targetPath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store, no-cache, must-revalidate" : "public, max-age=300"
    });
    res.end(content);
  } catch {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body><p>Context Studio UI bundle not built yet.</p></body></html>");
  }
}
async function handleSidecarRequest(req, res, ctx) {
  const method = (req.method ?? "GET").toUpperCase();
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname;
  if (method === "GET" && pathname === "/api/health") {
    const antigravityHome = resolveAntigravityHome(ctx.antigravityHome);
    const pluginDataDir = resolvePluginDataDir(ctx.pluginDataDir);
    const entries = await listConversationEntries(ctx.antigravityHome);
    let dataDirAccessible = true;
    try {
      await fs4.access(antigravityHome);
    } catch {
      dataDirAccessible = false;
    }
    sendJson(res, 200, {
      status: "ok",
      version: ctx.version,
      antigravityHome,
      pluginDataDir,
      dataDirAccessible,
      activeConversations: entries.length
    });
    return;
  }
  if (method === "GET" && pathname === "/api/conversations") {
    const conversations = await listConversationEntries(ctx.antigravityHome);
    sendJson(res, 200, { conversations });
    return;
  }
  if (method === "GET" && pathname === "/api/models") {
    const [config, entries] = await Promise.all([
      readPluginConfig(ctx.pluginDataDir),
      listConversationEntries(ctx.antigravityHome)
    ]);
    const seen = /* @__PURE__ */ new Map();
    for (const entry of entries.slice(0, 30)) {
      const parsed = await ctx.reader.readIncremental(entry.transcriptPath);
      if (parsed?.model) {
        const resolved = resolveModelLimit(parsed.model, config.modelOverrides);
        if (!seen.has(parsed.model)) {
          seen.set(parsed.model, {
            id: parsed.model,
            contextLimit: resolved.contextLimit,
            compactionThresholdPct: resolved.compactionThresholdPct,
            source: resolved.source === "override" ? "override" : "detected"
          });
        }
      }
    }
    for (const [pattern, override] of Object.entries(config.modelOverrides)) {
      if (!seen.has(pattern)) {
        seen.set(pattern, {
          id: pattern,
          contextLimit: override.contextLimit,
          compactionThresholdPct: override.compactionThresholdPct ?? 85,
          source: "override"
        });
      }
    }
    sendJson(res, 200, { models: [...seen.values()] });
    return;
  }
  if (method === "GET" && pathname === "/api/state") {
    const conversationId = await resolveTargetConversationId(
      url.searchParams.get("conversationId"),
      ctx.antigravityHome
    );
    if (!conversationId) {
      const empty = await buildContextSnapshot("none", {
        antigravityHome: ctx.antigravityHome,
        pluginDataDir: ctx.pluginDataDir,
        reader: ctx.reader
      });
      sendJson(res, 200, { ...empty, conversationId: "" });
      return;
    }
    const snapshot = await buildContextSnapshot(conversationId, {
      antigravityHome: ctx.antigravityHome,
      pluginDataDir: ctx.pluginDataDir,
      reader: ctx.reader
    });
    sendJson(res, 200, snapshot);
    return;
  }
  if (method === "GET" && pathname === "/api/events") {
    const conversationId = await resolveTargetConversationId(
      url.searchParams.get("conversationId"),
      ctx.antigravityHome
    );
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders?.();
    if (!conversationId) {
      res.write('event: empty\ndata: {"conversationId":null}\n\n');
      return;
    }
    await ctx.watcher.subscribe(conversationId, res);
    return;
  }
  if (method === "GET" && pathname === "/api/history") {
    const rawDays = Number(url.searchParams.get("days") ?? "7");
    const days = Number.isFinite(rawDays) ? rawDays : 7;
    const history = await aggregateUsageHistory({
      days,
      antigravityHome: ctx.antigravityHome,
      reader: ctx.reader
    });
    sendJson(res, 200, history);
    return;
  }
  if (method === "GET" && pathname === "/api/settings") {
    const config = await readPluginConfig(ctx.pluginDataDir);
    sendJson(res, 200, config);
    return;
  }
  if (method === "PUT" && pathname === "/api/settings") {
    try {
      const body = await readJsonBody(req);
      const updated = await writePluginConfig(body, ctx.pluginDataDir);
      sendJson(res, 200, updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid settings payload";
      sendJson(res, 400, { error: message });
    }
    return;
  }
  if (pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "API route not found" });
    return;
  }
  if (method !== "GET" && method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  await serveStaticAsset(res, ctx.publicDir, pathname);
}

// src/sidecar/watcher.ts
import fs5 from "node:fs";
import path5 from "node:path";
var TranscriptWatchManager = class {
  channels = /* @__PURE__ */ new Map();
  options;
  debounceMs;
  heartbeatTimer;
  constructor(options) {
    this.options = options;
    this.debounceMs = options.debounceMs ?? 250;
    const heartbeatMs = options.heartbeatMs ?? 25e3;
    this.heartbeatTimer = setInterval(() => {
      this.broadcastHeartbeats();
    }, heartbeatMs);
    this.heartbeatTimer.unref();
  }
  async subscribe(conversationId, res) {
    const channel = this.getOrCreateChannel(conversationId);
    channel.subscribers.add(res);
    res.on("close", () => {
      this.unsubscribe(conversationId, res);
    });
    await this.pushSnapshotTo(conversationId, res);
  }
  unsubscribe(conversationId, res) {
    const channel = this.channels.get(conversationId);
    if (!channel) {
      return;
    }
    channel.subscribers.delete(res);
    if (channel.subscribers.size === 0) {
      this.teardownChannel(conversationId, channel);
    }
  }
  close() {
    clearInterval(this.heartbeatTimer);
    for (const [conversationId, channel] of this.channels.entries()) {
      for (const res of channel.subscribers) {
        try {
          res.end();
        } catch {
        }
      }
      this.teardownChannel(conversationId, channel);
    }
    this.channels.clear();
  }
  getOrCreateChannel(conversationId) {
    const existing = this.channels.get(conversationId);
    if (existing) {
      return existing;
    }
    const transcriptPath = resolveTranscriptPath(conversationId, this.options.antigravityHome);
    const channel = {
      conversationId,
      transcriptPath,
      subscribers: /* @__PURE__ */ new Set(),
      watcher: null,
      debounceTimer: null
    };
    const logsDir = path5.dirname(transcriptPath);
    try {
      channel.watcher = fs5.watch(logsDir, { persistent: false }, (_eventType, filename) => {
        if (!filename || path5.basename(filename.toString()) === path5.basename(transcriptPath)) {
          this.scheduleBroadcast(channel);
        }
      });
      channel.watcher.on("error", () => {
      });
    } catch {
    }
    this.channels.set(conversationId, channel);
    return channel;
  }
  scheduleBroadcast(channel) {
    if (channel.debounceTimer) {
      clearTimeout(channel.debounceTimer);
    }
    channel.debounceTimer = setTimeout(() => {
      channel.debounceTimer = null;
      void this.broadcastSnapshot(channel);
    }, this.debounceMs);
  }
  async broadcastSnapshot(channel) {
    if (channel.subscribers.size === 0) {
      return;
    }
    try {
      const snapshot = await buildContextSnapshot(channel.conversationId, {
        antigravityHome: this.options.antigravityHome,
        pluginDataDir: this.options.pluginDataDir,
        reader: this.options.reader
      });
      const payload = `event: snapshot
data: ${JSON.stringify(snapshot)}

`;
      for (const res of channel.subscribers) {
        if (!res.writableEnded) {
          res.write(payload);
        }
      }
    } catch {
    }
  }
  async pushSnapshotTo(conversationId, res) {
    try {
      const snapshot = await buildContextSnapshot(conversationId, {
        antigravityHome: this.options.antigravityHome,
        pluginDataDir: this.options.pluginDataDir,
        reader: this.options.reader
      });
      if (!res.writableEnded) {
        res.write(`event: snapshot
data: ${JSON.stringify(snapshot)}

`);
      }
    } catch {
    }
  }
  broadcastHeartbeats() {
    for (const channel of this.channels.values()) {
      for (const res of channel.subscribers) {
        if (!res.writableEnded) {
          res.write(": ping\n\n");
        }
      }
    }
  }
  teardownChannel(conversationId, channel) {
    if (channel.debounceTimer) {
      clearTimeout(channel.debounceTimer);
      channel.debounceTimer = null;
    }
    if (channel.watcher) {
      try {
        channel.watcher.close();
      } catch {
      }
      channel.watcher = null;
    }
    this.channels.delete(conversationId);
  }
};

// src/sidecar/server.ts
var __dirname = path6.dirname(fileURLToPath2(import.meta.url));
var DEFAULT_PUBLIC_DIR = path6.join(__dirname, "public");
var PLUGIN_VERSION = "0.1.0";
async function createSidecarServer(options = {}) {
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? Number(process.env.SIDECAR_PORT || process.env.PORT || 3847);
  const publicDir = options.publicDir ?? DEFAULT_PUBLIC_DIR;
  const reader = new IncrementalTranscriptReader();
  const watcher = new TranscriptWatchManager({
    antigravityHome: options.antigravityHome,
    pluginDataDir: options.pluginDataDir,
    reader,
    debounceMs: options.debounceMs
  });
  const server = http.createServer((req, res) => {
    void handleSidecarRequest(req, res, {
      version: PLUGIN_VERSION,
      publicDir,
      antigravityHome: options.antigravityHome,
      pluginDataDir: options.pluginDataDir,
      reader,
      watcher
    }).catch((error) => {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Internal server error"
          })
        );
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : requestedPort;
  const close = async () => {
    watcher.close();
    await new Promise((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve());
    });
  };
  return {
    server,
    watcher,
    port: actualPort,
    host,
    close
  };
}
var isDirectEntry = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(path6.resolve(process.argv[1])).href;
if (isDirectEntry) {
  createSidecarServer().then((instance) => {
    console.log(`[agy-context-studio] sidecar listening on http://${instance.host}:${instance.port}`);
    const shutdown = () => {
      void instance.close().finally(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }).catch((error) => {
    console.error("[agy-context-studio] failed to start sidecar server:", error);
    process.exitCode = 1;
  });
}
export {
  createSidecarServer
};
