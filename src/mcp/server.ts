import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  buildContextSnapshot,
  listConversationEntries,
  resolvePluginDataDir
} from '../core/index.js';
import { CONTEXT_CARD_URI, renderContextCardHtml } from './cardHtml.js';

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export interface McpRuntimeOptions {
  antigravityHome?: string;
  pluginDataDir?: string;
}

const TOOL_SCHEMA = {
  name: 'get_context_health',
  title: 'Context Health',
  description:
    'Inspect exact current context window fill, prompt cache hit rate, top context bloaters, and subagent token totals from local Antigravity transcripts.',
  inputSchema: {
    type: 'object',
    properties: {
      conversationId: {
        type: 'string',
        description: 'Optional conversation ID. Defaults to the most recently updated session.'
      }
    }
  },
  _meta: {
    ui: {
      resourceUri: CONTEXT_CARD_URI
    }
  }
};

export async function handleMcpRequest(
  req: JsonRpcRequest,
  options: McpRuntimeOptions = {}
): Promise<JsonRpcResponse | null> {
  // Notifications (no id) do not receive JSON-RPC responses
  if (req.id === undefined) {
    return null;
  }

  const id = req.id;
  const pluginDataDir = resolvePluginDataDir(options.pluginDataDir);

  switch (req.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          serverInfo: {
            name: 'agy-context-studio',
            version: '0.1.1'
          },
          capabilities: {
            tools: {},
            resources: {}
          }
        }
      };

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [TOOL_SCHEMA]
        }
      };

    case 'tools/call': {
      const params = req.params ?? {};
      const toolName = params.name;
      if (toolName !== 'get_context_health') {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${String(toolName)}` }
        };
      }

      const args = (params.arguments ?? {}) as Record<string, unknown>;
      let conversationId =
        typeof args.conversationId === 'string' && args.conversationId.trim().length > 0
          ? args.conversationId.trim()
          : '';

      if (!conversationId) {
        const entries = await listConversationEntries(options.antigravityHome);
        conversationId = entries[0]?.conversationId ?? 'none';
      }

      const snapshot = await buildContextSnapshot(conversationId, {
        antigravityHome: options.antigravityHome,
        pluginDataDir
      });

      const limitText = snapshot.modelLimit.contextLimit
        ? snapshot.modelLimit.contextLimit.toLocaleString('en-US')
        : 'unknown';
      const usageText = snapshot.usagePct !== null ? `${snapshot.usagePct.toFixed(1)}%` : '-';
      const cacheText = `${(snapshot.turnCacheHitRate * 100).toFixed(1)}%`;

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: [
                `Conversation: ${snapshot.conversationId}`,
                `Model: ${snapshot.model ?? '-'}`,
                `Context Fill: ${snapshot.totalInputTokens.toLocaleString('en-US')} / ${limitText} (${usageText})`,
                `Turn Cache Hit: ${cacheText}`,
                `Turns: ${snapshot.turnCount}, Compactions: ${snapshot.compactionCount}`
              ].join('\n')
            }
          ],
          structuredContent: snapshot
        }
      };
    }

    case 'resources/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resources: [
            {
              uri: CONTEXT_CARD_URI,
              name: 'Context Studio Health Card',
              mimeType: 'text/html;profile=mcp-app'
            }
          ]
        }
      };

    case 'resources/read': {
      const uri = req.params?.uri;
      if (uri !== CONTEXT_CARD_URI) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: `Unknown resource URI: ${String(uri)}` }
        };
      }
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri: CONTEXT_CARD_URI,
              mimeType: 'text/html;profile=mcp-app',
              text: renderContextCardHtml()
            }
          ]
        }
      };
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${req.method}` }
      };
  }
}

function startStdioMcpServer(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      const errResp: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      };
      process.stdout.write(`${JSON.stringify(errResp)}\n`);
      return;
    }

    void handleMcpRequest(req)
      .then((response) => {
        if (response) {
          process.stdout.write(`${JSON.stringify(response)}\n`);
        }
      })
      .catch((error) => {
        if (req.id !== undefined) {
          const errResp: JsonRpcResponse = {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error'
            }
          };
          process.stdout.write(`${JSON.stringify(errResp)}\n`);
        }
      });
  });
}

function isDirectEntryModule(): boolean {
  if (typeof process.argv[1] !== 'string' || process.argv[1].trim().length === 0) {
    return false;
  }
  try {
    return (
      fs.realpathSync(fileURLToPath(import.meta.url)) ===
      fs.realpathSync(path.resolve(process.argv[1]))
    );
  } catch {
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
  }
}

if (isDirectEntryModule()) {
  startStdioMcpServer();
}
