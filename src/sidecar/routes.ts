import fs from 'node:fs/promises';
import type http from 'node:http';
import path from 'node:path';
import {
  aggregateUsageHistory,
  buildContextSnapshot,
  getBuiltinModelCatalog,
  type IncrementalTranscriptReader,
  listConversationEntries,
  type ModelOptionItem,
  type PluginConfig,
  readPluginConfig,
  resolveAntigravityHome,
  resolveModelLimit,
  resolvePluginDataDir,
  writePluginConfig
} from '../core/index.js';
import type { TranscriptWatchManager } from './watcher.js';

const MAX_JSON_BODY_BYTES = 64 * 1024;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

export interface SidecarRouterContext {
  version: string;
  publicDir: string;
  antigravityHome?: string;
  pluginDataDir?: string;
  reader: IncrementalTranscriptReader;
  watcher: TranscriptWatchManager;
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new Error('Request body too large');
    }
    chunks.push(buf);
  }

  const rawText = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawText) {
    return {};
  }
  const parsed = JSON.parse(rawText) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON body must be an object');
  }
  return parsed as Record<string, unknown>;
}

async function resolveTargetConversationId(
  queryParam: string | null,
  antigravityHome?: string
): Promise<string | null> {
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

async function serveStaticAsset(
  res: http.ServerResponse,
  publicDir: string,
  pathname: string
): Promise<void> {
  const resolvedRoot = path.resolve(publicDir);
  const relativeRequest = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(resolvedRoot, relativeRequest);

  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let targetPath = candidate;
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      targetPath = path.join(targetPath, 'index.html');
    }
  } catch {
    // SPA fallback to index.html for client-side routes without file extension
    if (!path.extname(relativeRequest)) {
      targetPath = path.join(resolvedRoot, 'index.html');
    } else {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
  }

  try {
    const content = await fs.readFile(targetPath);
    const ext = path.extname(targetPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store, no-cache, must-revalidate' : 'public, max-age=300'
    });
    res.end(content);
  } catch {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><body><p>Context Studio UI bundle not built yet.</p></body></html>');
  }
}

export async function handleSidecarRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: SidecarRouterContext
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    const antigravityHome = resolveAntigravityHome(ctx.antigravityHome);
    const pluginDataDir = resolvePluginDataDir(ctx.pluginDataDir);
    const entries = await listConversationEntries(ctx.antigravityHome);
    let dataDirAccessible = true;
    try {
      await fs.access(antigravityHome);
    } catch {
      dataDirAccessible = false;
    }
    sendJson(res, 200, {
      status: 'ok',
      version: ctx.version,
      antigravityHome,
      pluginDataDir,
      dataDirAccessible,
      activeConversations: entries.length
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/conversations') {
    const conversations = await listConversationEntries(ctx.antigravityHome);
    sendJson(res, 200, { conversations });
    return;
  }

  if (method === 'GET' && pathname === '/api/models') {
    const [config, entries] = await Promise.all([
      readPluginConfig(ctx.pluginDataDir),
      listConversationEntries(ctx.antigravityHome)
    ]);

    const seen = new Map<string, ModelOptionItem>();

    // 1. Models detected in the 8 most recent sessions
    for (const entry of entries.slice(0, 8)) {
      const parsed = await ctx.reader.readIncremental(entry.transcriptPath);
      if (parsed?.model) {
        const resolved = resolveModelLimit(parsed.model, config.modelOverrides);
        if (!seen.has(parsed.model)) {
          seen.set(parsed.model, {
            id: parsed.model,
            contextLimit: resolved.contextLimit,
            compactionThresholdPct: resolved.compactionThresholdPct,
            source: resolved.source === 'override' ? 'override' : 'detected'
          });
        }
      }
    }

    // 2. Configured overrides
    for (const [pattern, override] of Object.entries(config.modelOverrides)) {
      if (!seen.has(pattern)) {
        seen.set(pattern, {
          id: pattern,
          contextLimit: override.contextLimit,
          compactionThresholdPct: override.compactionThresholdPct ?? 85,
          source: 'override'
        });
      }
    }

    // 3. Built-in model catalog entries
    for (const entry of getBuiltinModelCatalog()) {
      if (!seen.has(entry.pattern)) {
        const resolved = resolveModelLimit(entry.pattern, config.modelOverrides);
        seen.set(entry.pattern, {
          id: entry.pattern,
          contextLimit: resolved.contextLimit ?? entry.contextLimit,
          compactionThresholdPct: resolved.compactionThresholdPct ?? entry.compactionThresholdPct,
          source: resolved.source === 'override' ? 'override' : 'catalog'
        });
      }
    }

    sendJson(res, 200, { models: [...seen.values()] });
    return;
  }

  if (method === 'GET' && pathname === '/api/state') {
    const conversationId = await resolveTargetConversationId(
      url.searchParams.get('conversationId'),
      ctx.antigravityHome
    );
    if (!conversationId) {
      const empty = await buildContextSnapshot('none', {
        antigravityHome: ctx.antigravityHome,
        pluginDataDir: ctx.pluginDataDir,
        reader: ctx.reader
      });
      sendJson(res, 200, { ...empty, conversationId: '' });
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

  if (method === 'GET' && pathname === '/api/events') {
    const conversationId = await resolveTargetConversationId(
      url.searchParams.get('conversationId'),
      ctx.antigravityHome
    );
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();

    if (!conversationId) {
      res.write('event: empty\ndata: {"conversationId":null}\n\n');
      return;
    }

    await ctx.watcher.subscribe(conversationId, res);
    return;
  }

  if (method === 'GET' && pathname === '/api/history') {
    const rawDays = Number(url.searchParams.get('days') ?? '7');
    const days = Number.isFinite(rawDays) ? rawDays : 7;
    const history = await aggregateUsageHistory({
      days,
      antigravityHome: ctx.antigravityHome,
      reader: ctx.reader
    });
    sendJson(res, 200, history);
    return;
  }

  if (method === 'GET' && pathname === '/api/settings') {
    const config = await readPluginConfig(ctx.pluginDataDir);
    sendJson(res, 200, config);
    return;
  }

  if (method === 'PUT' && pathname === '/api/settings') {
    try {
      const body = await readJsonBody(req);
      const updated = await writePluginConfig(body as Partial<PluginConfig>, ctx.pluginDataDir);
      sendJson(res, 200, updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid settings payload';
      sendJson(res, 400, { error: message });
    }
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'API route not found' });
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  await serveStaticAsset(res, ctx.publicDir, pathname);
}
