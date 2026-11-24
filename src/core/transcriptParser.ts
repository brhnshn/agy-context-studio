import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ParsedStepSummary,
  ParsedTranscriptState,
  RawTranscriptStep,
  SubagentRef,
  TurnTelemetry
} from './types.js';

interface CursorState {
  byteOffset: number;
  fileSize: number;
  mtimeMs: number;
  state: ParsedTranscriptState;
  pendingToolName?: string;
  pendingSubagentMeta?: {
    role?: string;
    typeName?: string;
    stepIndex: number;
  };
  seenSubagentIds: Set<string>;
}

function createEmptyState(filePath: string): ParsedTranscriptState {
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

function createInitialCursor(filePath: string): CursorState {
  return {
    byteOffset: 0,
    fileSize: 0,
    mtimeMs: 0,
    state: createEmptyState(filePath),
    seenSubagentIds: new Set<string>()
  };
}

function toFiniteNonNegative(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function utf8Bytes(value: unknown): number {
  if (typeof value !== 'string' || value.length === 0) {
    return 0;
  }
  return Buffer.byteLength(value, 'utf8');
}

function sanitizeLabel(text: string, fallback: string): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (!singleLine) {
    return fallback;
  }
  if (singleLine.length <= 72) {
    return singleLine;
  }
  return `${singleLine.slice(0, 69)}...`;
}

function uriToFilePath(uri: string): string | undefined {
  if (!uri.startsWith('file://')) {
    return undefined;
  }
  try {
    return path.normalize(fileURLToPath(uri));
  } catch {
    return undefined;
  }
}

function extractSubagentFromContent(content: string): {
  conversationId: string;
  transcriptPath?: string;
} | null {
  if (!content.includes('"conversationId"') && !content.includes('Created the following subagent')) {
    return null;
  }

  const startIdx = content.indexOf('{');
  const endIdx = content.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    const maybeJson = content.slice(startIdx, endIdx + 1);
    try {
      const parsed = JSON.parse(maybeJson) as Record<string, unknown>;
      if (typeof parsed.conversationId === 'string' && parsed.conversationId.trim().length > 0) {
        const transcriptPath =
          typeof parsed.logAbsoluteUri === 'string' ? uriToFilePath(parsed.logAbsoluteUri) : undefined;
        return {
          conversationId: parsed.conversationId.trim(),
          transcriptPath
        };
      }
    } catch {
      // Fall through to regex extraction
    }
  }

  const match = content.match(/"conversationId"\s*:\s*"([0-9a-fA-F-]+)"/);
  if (match && match[1]) {
    const uriMatch = content.match(/"logAbsoluteUri"\s*:\s*"([^"]+)"/);
    return {
      conversationId: match[1],
      transcriptPath: uriMatch && uriMatch[1] ? uriToFilePath(uriMatch[1]) : undefined
    };
  }

  return null;
}

function computeVelocity(turns: TurnTelemetry[]): number | null {
  if (turns.length < 2) {
    return null;
  }

  // Compute average token delta since the most recent compaction boundary (if any)
  let windowStartIdx = 0;
  for (let i = 1; i < turns.length; i += 1) {
    const prev = turns[i - 1]!;
    const curr = turns[i]!;
    const drop = prev.totalInputTokens - curr.totalInputTokens;
    if (prev.totalInputTokens > 0 && drop > 5000 && drop / prev.totalInputTokens > 0.2) {
      windowStartIdx = i;
    }
  }

  const windowTurns = turns.slice(windowStartIdx);
  if (windowTurns.length < 2) {
    return null;
  }

  const first = windowTurns[0]!;
  const last = windowTurns[windowTurns.length - 1]!;
  return Math.round((last.totalInputTokens - first.totalInputTokens) / (windowTurns.length - 1));
}

function processParsedStep(cursor: CursorState, step: RawTranscriptStep): void {
  const { state } = cursor;
  const stepIndex = typeof step.step_index === 'number' ? step.step_index : state.steps.length;
  const createdAt = typeof step.created_at === 'string' ? step.created_at : undefined;

  if (createdAt) {
    if (!state.firstTimestamp) {
      state.firstTimestamp = createdAt;
    }
    state.lastTimestamp = createdAt;
  }

  const stepType = step.type ?? '';

  if (stepType === 'USER_INPUT') {
    cursor.pendingToolName = undefined;
    cursor.pendingSubagentMeta = undefined;
    const bytes = utf8Bytes(step.content);
    if (bytes > 0) {
      state.steps.push({
        stepIndex,
        category: 'user',
        label: sanitizeLabel(step.content ?? '', `User input #${stepIndex}`),
        bytes,
        createdAt
      });
    }
    return;
  }

  if (stepType === 'SYSTEM_MESSAGE' || stepType === 'EPHEMERAL_MESSAGE') {
    const bytes = utf8Bytes(step.content);
    if (bytes > 0) {
      state.steps.push({
        stepIndex,
        category: 'system',
        label: `${stepType === 'EPHEMERAL_MESSAGE' ? 'Ephemeral' : 'System'} #${stepIndex}`,
        bytes,
        createdAt
      });
    }
    return;
  }

  if (stepType === 'PLANNER_RESPONSE') {
    cursor.pendingToolName = undefined;
    cursor.pendingSubagentMeta = undefined;

    if (typeof step.model === 'string' && step.model.trim().length > 0) {
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
      if (drop > 5000 && drop / prevTurn.totalInputTokens > 0.2) {
        state.compactionCount += 1;
      }
    }

    const turn: TurnTelemetry = {
      stepIndex,
      model: state.model ?? undefined,
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
    state.cumulativeCacheHitRate =
      state.cumulativeTotalInputTokens > 0
        ? state.cumulativeCacheReadTokens / state.cumulativeTotalInputTokens
        : 0;
    state.velocityTokensPerTurn = computeVelocity(state.turns);

    const thinkingBytes = utf8Bytes(step.thinking);
    if (thinkingBytes > 0) {
      state.steps.push({
        stepIndex,
        category: 'thinking',
        label: `Thinking #${stepIndex}`,
        bytes: thinkingBytes,
        createdAt
      });
    }

    const contentBytes = utf8Bytes(step.content);
    if (contentBytes > 0) {
      state.steps.push({
        stepIndex,
        category: 'assistant',
        label: sanitizeLabel(step.content ?? '', `Assistant reply #${stepIndex}`),
        bytes: contentBytes,
        createdAt
      });
    }

    if (Array.isArray(step.tool_calls) && step.tool_calls.length > 0) {
      const toolNames = step.tool_calls
        .map((call) => (typeof call?.name === 'string' ? call.name.trim() : ''))
        .filter(Boolean);
      const primaryToolName = toolNames[0] ?? 'tool_call';
      cursor.pendingToolName = toolNames.length > 1 ? toolNames.join(', ') : primaryToolName;

      const subagentCall = step.tool_calls.find((call) => call?.name === 'invoke_subagent');
      if (subagentCall) {
        const args = subagentCall.args ?? {};
        cursor.pendingSubagentMeta = {
          role: typeof args.Role === 'string' ? args.Role : undefined,
          typeName: typeof args.TypeName === 'string' ? args.TypeName : undefined,
          stepIndex
        };
      }

      const serializedCalls = JSON.stringify(step.tool_calls);
      const callBytes = Buffer.byteLength(serializedCalls, 'utf8');
      if (callBytes > 0) {
        state.steps.push({
          stepIndex,
          category: 'tools',
          label: `Call: ${cursor.pendingToolName}`,
          toolName: primaryToolName,
          bytes: callBytes,
          createdAt
        });
      }
    }
    return;
  }

  if (stepType === 'GENERIC') {
    const content = typeof step.content === 'string' ? step.content : '';
    const bytes = utf8Bytes(content);
    const toolLabel = cursor.pendingToolName ? `Result: ${cursor.pendingToolName}` : `Tool output #${stepIndex}`;

    if (bytes > 0) {
      state.steps.push({
        stepIndex,
        category: 'tools',
        label: toolLabel,
        toolName: cursor.pendingToolName,
        bytes,
        createdAt
      });
    }

    const extracted = extractSubagentFromContent(content);
    if (extracted && !cursor.seenSubagentIds.has(extracted.conversationId)) {
      cursor.seenSubagentIds.add(extracted.conversationId);
      const ref: SubagentRef = {
        conversationId: extracted.conversationId,
        transcriptPath: extracted.transcriptPath,
        role: cursor.pendingSubagentMeta?.role,
        typeName: cursor.pendingSubagentMeta?.typeName,
        spawnedAtStep: cursor.pendingSubagentMeta?.stepIndex ?? stepIndex,
        createdAt
      };
      state.subagentRefs.push(ref);
      cursor.pendingSubagentMeta = undefined;
    }
    return;
  }

  // Fallback for any other custom step types
  const fallbackBytes = utf8Bytes(step.content);
  if (fallbackBytes > 0) {
    state.steps.push({
      stepIndex,
      category: step.source === 'USER_EXPLICIT' ? 'user' : 'system',
      label: sanitizeLabel(step.content ?? '', `Step #${stepIndex}`),
      bytes: fallbackBytes,
      createdAt
    });
  }
}

export class IncrementalTranscriptReader {
  private readonly cursors = new Map<string, CursorState>();

  public clear(filePath?: string): void {
    if (filePath) {
      this.cursors.delete(path.resolve(filePath));
    } else {
      this.cursors.clear();
    }
  }

  public async readIncremental(filePath: string): Promise<ParsedTranscriptState | null> {
    const resolvedPath = path.resolve(filePath);
    let stat;
    try {
      stat = await fs.stat(resolvedPath);
    } catch {
      this.cursors.delete(resolvedPath);
      return null;
    }

    let cursor = this.cursors.get(resolvedPath);
    if (!cursor) {
      cursor = createInitialCursor(resolvedPath);
      this.cursors.set(resolvedPath, cursor);
    }

    // File unchanged since last read
    if (stat.size === cursor.fileSize && stat.mtimeMs === cursor.mtimeMs) {
      return cursor.state;
    }

    // File shrank or rotated: reset cursor and parse from byte 0
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

    const handle = await fs.open(resolvedPath, 'r');
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
      const lastNewlineIdx = slice.lastIndexOf(0x0a);

      // Wait until at least one complete newline-terminated line exists
      if (lastNewlineIdx === -1) {
        cursor.fileSize = stat.size;
        cursor.mtimeMs = stat.mtimeMs;
        return cursor.state;
      }

      const completeBytes = lastNewlineIdx + 1;
      const chunkText = slice.subarray(0, completeBytes).toString('utf8');
      const lines = chunkText.split(/\r?\n/);

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }
        try {
          const parsed = JSON.parse(line) as RawTranscriptStep;
          if (parsed && typeof parsed === 'object') {
            processParsedStep(cursor, parsed);
          }
        } catch {
          // Skip malformed JSON line safely without aborting transcript parsing
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
}

export async function parseTranscriptFile(filePath: string): Promise<ParsedTranscriptState | null> {
  const reader = new IncrementalTranscriptReader();
  return reader.readIncremental(filePath);
}
