import fs from 'node:fs/promises';
import path from 'node:path';
import { resolvePluginDataDir } from './paths.js';
import type { HookStateStore, LanguageCode, ModelOverride, PluginConfig } from './types.js';

export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  language: 'en',
  hookEnabled: true,
  warningThresholdPct: 70,
  criticalThresholdPct: 85,
  modelOverrides: {}
};

const CONFIG_FILE = 'config.json';
const HOOK_STATE_FILE = 'hook-state.json';

function clampThreshold(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(99, Math.max(10, Math.round(value)));
}

function normalizeLanguage(value: unknown, fallback: LanguageCode): LanguageCode {
  return value === 'tr' || value === 'en' ? value : fallback;
}

function normalizeOverrides(raw: unknown): Record<string, ModelOverride> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const normalized: Record<string, ModelOverride> = {};
  for (const [key, value] of Object.entries(raw)) {
    const trimmedKey = key.trim();
    if (!trimmedKey || !value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const candidate = value as Record<string, unknown>;
    const limit = candidate.contextLimit;
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
      continue;
    }
    const entry: ModelOverride = {
      contextLimit: Math.round(limit)
    };
    if (
      typeof candidate.compactionThresholdPct === 'number' &&
      Number.isFinite(candidate.compactionThresholdPct) &&
      candidate.compactionThresholdPct > 0 &&
      candidate.compactionThresholdPct <= 100
    ) {
      entry.compactionThresholdPct = Math.round(candidate.compactionThresholdPct);
    }
    normalized[trimmedKey] = entry;
  }
  return normalized;
}

export function sanitizePluginConfig(raw: unknown, base: PluginConfig = DEFAULT_PLUGIN_CONFIG): PluginConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...base, modelOverrides: { ...base.modelOverrides } };
  }

  const input = raw as Record<string, unknown>;
  const warningThresholdPct = clampThreshold(input.warningThresholdPct, base.warningThresholdPct);
  let criticalThresholdPct = clampThreshold(input.criticalThresholdPct, base.criticalThresholdPct);
  if (criticalThresholdPct <= warningThresholdPct) {
    criticalThresholdPct = Math.min(99, warningThresholdPct + 5);
  }

  return {
    language: normalizeLanguage(input.language, base.language),
    hookEnabled: typeof input.hookEnabled === 'boolean' ? input.hookEnabled : base.hookEnabled,
    warningThresholdPct,
    criticalThresholdPct,
    modelOverrides:
      input.modelOverrides !== undefined
        ? normalizeOverrides(input.modelOverrides)
        : { ...base.modelOverrides }
  };
}

async function writeJsonAtomic(filePath: string, payload: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

export async function readPluginConfig(dataDir?: string): Promise<PluginConfig> {
  const configPath = path.join(resolvePluginDataDir(dataDir), CONFIG_FILE);
  try {
    const rawText = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(rawText) as unknown;
    return sanitizePluginConfig(parsed, DEFAULT_PLUGIN_CONFIG);
  } catch {
    return sanitizePluginConfig({}, DEFAULT_PLUGIN_CONFIG);
  }
}

export async function writePluginConfig(
  partial: Partial<PluginConfig>,
  dataDir?: string
): Promise<PluginConfig> {
  const current = await readPluginConfig(dataDir);
  const next = sanitizePluginConfig(
    {
      ...current,
      ...partial,
      modelOverrides: partial.modelOverrides !== undefined ? partial.modelOverrides : current.modelOverrides
    },
    current
  );
  const configPath = path.join(resolvePluginDataDir(dataDir), CONFIG_FILE);
  await writeJsonAtomic(configPath, next);
  return next;
}

export async function readHookState(dataDir?: string): Promise<HookStateStore> {
  const statePath = path.join(resolvePluginDataDir(dataDir), HOOK_STATE_FILE);
  try {
    const rawText = await fs.readFile(statePath, 'utf8');
    const parsed = JSON.parse(rawText) as Partial<HookStateStore>;
    if (!parsed || typeof parsed !== 'object' || !parsed.sessions || typeof parsed.sessions !== 'object') {
      return { sessions: {} };
    }
    return { sessions: parsed.sessions };
  } catch {
    return { sessions: {} };
  }
}

export async function writeHookState(state: HookStateStore, dataDir?: string): Promise<void> {
  const statePath = path.join(resolvePluginDataDir(dataDir), HOOK_STATE_FILE);
  await writeJsonAtomic(statePath, state);
}
