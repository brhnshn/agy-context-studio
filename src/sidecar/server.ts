import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IncrementalTranscriptReader } from '../core/index.js';
import { handleSidecarRequest } from './routes.js';
import { TranscriptWatchManager } from './watcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_DIR = path.join(__dirname, 'public');
const PLUGIN_VERSION = '0.1.0';

function isDirectEntryModule(): boolean {
  if (typeof process.argv[1] !== 'string' || process.argv[1].trim().length === 0) {
    return false;
  }
  try {
    const currentFile = fs.realpathSync(fileURLToPath(import.meta.url));
    const entryFile = fs.realpathSync(path.resolve(process.argv[1]));
    return currentFile === entryFile;
  } catch {
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
  }
}

export interface CreateSidecarServerOptions {
  port?: number;
  host?: string;
  publicDir?: string;
  antigravityHome?: string;
  pluginDataDir?: string;
  debounceMs?: number;
}

export interface SidecarServerInstance {
  server: http.Server;
  watcher: TranscriptWatchManager;
  port: number;
  host: string;
  close: () => Promise<void>;
}

export async function createSidecarServer(
  options: CreateSidecarServerOptions = {}
): Promise<SidecarServerInstance> {
  const host = options.host ?? '127.0.0.1';
  const requestedPort =
    options.port ??
    Number(
      process.env.ANTIGRAVITY_SIDECAR_WEB_PORT ||
        process.env.SIDECAR_PORT ||
        process.env.PORT ||
        3847
    );
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
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Internal server error'
          })
        );
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : requestedPort;

  const close = async (): Promise<void> => {
    watcher.close();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
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

if (isDirectEntryModule()) {
  createSidecarServer()
    .then((instance) => {
      console.log(`[sidecar] listening on ${instance.host}:${instance.port}`);
      const shutdown = () => {
        void instance.close().finally(() => process.exit(0));
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    })
    .catch((error) => {
      console.error('[agy-context-studio] failed to start sidecar server:', error);
      process.exitCode = 1;
    });
}
