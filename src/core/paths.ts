import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PLUGIN_DATA_FOLDER = 'agy-context-studio';

export function resolveHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

export function resolveAntigravityHome(overrideHome?: string): string {
  if (overrideHome && overrideHome.trim().length > 0) {
    return path.resolve(overrideHome);
  }
  const envHome = process.env.ANTIGRAVITY_HOME;
  if (envHome && envHome.trim().length > 0) {
    return path.resolve(envHome);
  }
  return path.join(resolveHomeDir(), '.gemini', 'antigravity');
}

export function resolvePluginDataDir(overrideDir?: string): string {
  if (overrideDir && overrideDir.trim().length > 0) {
    return path.resolve(overrideDir);
  }
  const envDir = process.env.AGY_CONTEXT_STUDIO_DATA || process.env.PLUGIN_DATA;
  if (envDir && envDir.trim().length > 0) {
    return path.resolve(envDir);
  }
  return path.join(resolveHomeDir(), '.gemini', 'config', 'plugin-data', PLUGIN_DATA_FOLDER);
}

export function resolveTranscriptPath(conversationId: string, antigravityHome?: string): string {
  const safeId = path.basename(conversationId.trim());
  return path.join(
    resolveAntigravityHome(antigravityHome),
    'brain',
    safeId,
    '.system_generated',
    'logs',
    'transcript.jsonl'
  );
}

export interface ConversationEntry {
  conversationId: string;
  transcriptPath: string;
  mtimeMs: number;
}

export async function listConversationEntries(antigravityHome?: string): Promise<ConversationEntry[]> {
  const brainDir = path.join(resolveAntigravityHome(antigravityHome), 'brain');
  let dirEntries;
  try {
    dirEntries = await fs.readdir(brainDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: ConversationEntry[] = [];
  for (const entry of dirEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const transcriptPath = path.join(brainDir, entry.name, '.system_generated', 'logs', 'transcript.jsonl');
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
      // Conversation may not have a transcript.jsonl yet
    }
  }

  results.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return results;
}

export async function listConversationIds(antigravityHome?: string): Promise<string[]> {
  const entries = await listConversationEntries(antigravityHome);
  return entries.map((entry) => entry.conversationId);
}
