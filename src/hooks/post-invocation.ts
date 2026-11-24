import { pathToFileURL } from 'node:url';
import {
  buildContextSnapshot,
  readHookState,
  readPluginConfig,
  writeHookState
} from '../core/index.js';
import {
  evaluateThresholdAlert,
  type HookOutputPayload,
  type PostInvocationHookPayload
} from './evaluator.js';

export async function runPostInvocationHook(
  rawInput: string,
  options: {
    antigravityHome?: string;
    pluginDataDir?: string;
  } = {}
): Promise<HookOutputPayload> {
  let payload: PostInvocationHookPayload;
  try {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return {};
    }
    payload = JSON.parse(trimmed) as PostInvocationHookPayload;
  } catch {
    return {};
  }

  const conversationId =
    typeof payload.conversationId === 'string' && payload.conversationId.trim().length > 0
      ? payload.conversationId.trim()
      : '';
  const transcriptPath =
    typeof payload.transcriptPath === 'string' && payload.transcriptPath.trim().length > 0
      ? payload.transcriptPath.trim()
      : undefined;

  if (!conversationId && !transcriptPath) {
    return {};
  }

  const [config, hookState] = await Promise.all([
    readPluginConfig(options.pluginDataDir),
    readHookState(options.pluginDataDir)
  ]);

  const sessionKey = conversationId || transcriptPath || 'default';
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

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

const isDirectEntry =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectEntry) {
  readStdin()
    .then((stdinText) => runPostInvocationHook(stdinText))
    .then((output) => {
      process.stdout.write(`${JSON.stringify(output)}\n`);
    })
    .catch(() => {
      process.stdout.write('{}\n');
    });
}
