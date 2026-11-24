interface SidecarGlobal {
  conversationId?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  config?: {
    conversationId?: string;
  };
  agent?: {
    sendMessage?: (prompt: string, convId?: string) => Promise<unknown> | unknown;
  };
}

declare global {
  interface Window {
    sidecar?: SidecarGlobal;
  }
}

export function getHostConversationId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryConv = params.get('conversationId');
    if (queryConv && queryConv.trim().length > 0) {
      return queryConv.trim();
    }
  } catch {
    // Ignore invalid location
  }

  const fromConfig = window.sidecar?.config?.conversationId;
  if (typeof fromConfig === 'string' && fromConfig.trim().length > 0) {
    return fromConfig.trim();
  }

  const fromRoot = window.sidecar?.conversationId;
  if (typeof fromRoot === 'string' && fromRoot.trim().length > 0) {
    return fromRoot.trim();
  }

  return null;
}

export function isAgentBridgeAvailable(): boolean {
  return typeof window.sidecar?.agent?.sendMessage === 'function';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function sendAgentMessage(
  prompt: string
): Promise<{ ok: boolean; mode: 'sidecar' | 'clipboard' }> {
  const sendFn = window.sidecar?.agent?.sendMessage;
  if (typeof sendFn === 'function') {
    try {
      await sendFn(prompt);
      return { ok: true, mode: 'sidecar' };
    } catch {
      // Fall through to clipboard fallback
    }
  }

  const copied = await copyText(prompt);
  return { ok: copied, mode: 'clipboard' };
}
