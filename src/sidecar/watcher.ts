import fs, { type FSWatcher } from 'node:fs';
import type http from 'node:http';
import path from 'node:path';
import {
  buildContextSnapshot,
  type IncrementalTranscriptReader,
  resolveTranscriptPath
} from '../core/index.js';

interface WatchChannel {
  conversationId: string;
  transcriptPath: string;
  subscribers: Set<http.ServerResponse>;
  watcher: FSWatcher | null;
  debounceTimer: NodeJS.Timeout | null;
}

export interface WatchManagerOptions {
  antigravityHome?: string;
  pluginDataDir?: string;
  reader: IncrementalTranscriptReader;
  debounceMs?: number;
  heartbeatMs?: number;
}

export class TranscriptWatchManager {
  private readonly channels = new Map<string, WatchChannel>();
  private readonly options: WatchManagerOptions;
  private readonly debounceMs: number;
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor(options: WatchManagerOptions) {
    this.options = options;
    this.debounceMs = options.debounceMs ?? 250;
    const heartbeatMs = options.heartbeatMs ?? 25_000;
    this.heartbeatTimer = setInterval(() => {
      this.broadcastHeartbeats();
    }, heartbeatMs);
    this.heartbeatTimer.unref();
  }

  public async subscribe(conversationId: string, res: http.ServerResponse): Promise<void> {
    const channel = this.getOrCreateChannel(conversationId);
    channel.subscribers.add(res);

    res.on('close', () => {
      this.unsubscribe(conversationId, res);
    });

    await this.pushSnapshotTo(conversationId, res);
  }

  public unsubscribe(conversationId: string, res: http.ServerResponse): void {
    const channel = this.channels.get(conversationId);
    if (!channel) {
      return;
    }
    channel.subscribers.delete(res);
    if (channel.subscribers.size === 0) {
      this.teardownChannel(conversationId, channel);
    }
  }

  public close(): void {
    clearInterval(this.heartbeatTimer);
    for (const [conversationId, channel] of this.channels.entries()) {
      for (const res of channel.subscribers) {
        try {
          res.end();
        } catch {
          // Ignore closed streams
        }
      }
      this.teardownChannel(conversationId, channel);
    }
    this.channels.clear();
  }

  private getOrCreateChannel(conversationId: string): WatchChannel {
    const existing = this.channels.get(conversationId);
    if (existing) {
      return existing;
    }

    const transcriptPath = resolveTranscriptPath(conversationId, this.options.antigravityHome);
    const channel: WatchChannel = {
      conversationId,
      transcriptPath,
      subscribers: new Set(),
      watcher: null,
      debounceTimer: null
    };

    const logsDir = path.dirname(transcriptPath);
    try {
      channel.watcher = fs.watch(logsDir, { persistent: false }, (_eventType, filename) => {
        if (!filename || path.basename(filename.toString()) === path.basename(transcriptPath)) {
          this.scheduleBroadcast(channel);
        }
      });
      channel.watcher.on('error', () => {
        // Directory may be removed or unavailable; keep channel alive for manual/poll recovery
      });
    } catch {
      // Directory might not exist yet; snapshot will still report status: 'missing'
    }

    this.channels.set(conversationId, channel);
    return channel;
  }

  private scheduleBroadcast(channel: WatchChannel): void {
    if (channel.debounceTimer) {
      clearTimeout(channel.debounceTimer);
    }
    channel.debounceTimer = setTimeout(() => {
      channel.debounceTimer = null;
      void this.broadcastSnapshot(channel);
    }, this.debounceMs);
  }

  private async broadcastSnapshot(channel: WatchChannel): Promise<void> {
    if (channel.subscribers.size === 0) {
      return;
    }
    try {
      const snapshot = await buildContextSnapshot(channel.conversationId, {
        antigravityHome: this.options.antigravityHome,
        pluginDataDir: this.options.pluginDataDir,
        reader: this.options.reader
      });
      const payload = `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
      for (const res of channel.subscribers) {
        if (!res.writableEnded) {
          res.write(payload);
        }
      }
    } catch {
      // Avoid crashing watch loop on transient read errors
    }
  }

  private async pushSnapshotTo(conversationId: string, res: http.ServerResponse): Promise<void> {
    try {
      const snapshot = await buildContextSnapshot(conversationId, {
        antigravityHome: this.options.antigravityHome,
        pluginDataDir: this.options.pluginDataDir,
        reader: this.options.reader
      });
      if (!res.writableEnded) {
        res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
      }
    } catch {
      // Ignore transient snapshot build errors
    }
  }

  private broadcastHeartbeats(): void {
    for (const channel of this.channels.values()) {
      for (const res of channel.subscribers) {
        if (!res.writableEnded) {
          res.write(': ping\n\n');
        }
      }
    }
  }

  private teardownChannel(conversationId: string, channel: WatchChannel): void {
    if (channel.debounceTimer) {
      clearTimeout(channel.debounceTimer);
      channel.debounceTimer = null;
    }
    if (channel.watcher) {
      try {
        channel.watcher.close();
      } catch {
        // Ignore close errors
      }
      channel.watcher = null;
    }
    this.channels.delete(conversationId);
  }
}
