import type {
  ContextSnapshot,
  ModelOptionItem,
  PluginConfig,
  UsageHistory
} from '../../core/types.js';

export interface ConversationListItem {
  conversationId: string;
  transcriptPath: string;
  mtimeMs: number;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const fetcher = typeof window.sidecar?.fetch === 'function' ? window.sidecar.fetch : fetch;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {})
  };
  try {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token && !headers['x-sidecar-token']) {
      headers['x-sidecar-token'] = token;
    }
  } catch {
    // Ignore invalid location
  }
  const response = await fetcher(url, {
    ...init,
    headers
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

export function fetchState(conversationId?: string | null): Promise<ContextSnapshot> {
  const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : '';
  return requestJson<ContextSnapshot>(`/api/state${query}`);
}

export async function fetchConversations(): Promise<ConversationListItem[]> {
  const payload = await requestJson<{ conversations?: ConversationListItem[] }>('/api/conversations');
  return Array.isArray(payload.conversations) ? payload.conversations : [];
}

export async function fetchModels(): Promise<ModelOptionItem[]> {
  const payload = await requestJson<{ models?: ModelOptionItem[] }>('/api/models');
  return Array.isArray(payload.models) ? payload.models : [];
}

export function fetchHistory(days = 7): Promise<UsageHistory> {
  return requestJson<UsageHistory>(`/api/history?days=${encodeURIComponent(String(days))}`);
}

export function fetchSettings(): Promise<PluginConfig> {
  return requestJson<PluginConfig>('/api/settings');
}

export function updateSettings(partial: Partial<PluginConfig>): Promise<PluginConfig> {
  return requestJson<PluginConfig>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(partial)
  });
}

function buildEventsUrl(conversationId: string | null): string {
  const params = new URLSearchParams();
  if (conversationId) {
    params.set('conversationId', conversationId);
  }
  try {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      params.set('token', token);
    }
  } catch {
    // Ignore invalid location
  }
  const qs = params.toString();
  return qs ? `/api/events?${qs}` : '/api/events';
}

export function subscribeToState(
  conversationId: string | null,
  onSnapshot: (snapshot: ContextSnapshot) => void,
  onStatusChange?: (connected: boolean) => void
): () => void {
  let source: EventSource | null = null;
  let disposed = false;

  const connect = () => {
    if (disposed || document.visibilityState === 'hidden') {
      return;
    }
    source = new EventSource(buildEventsUrl(conversationId));

    source.addEventListener('open', () => {
      onStatusChange?.(true);
    });

    source.addEventListener('snapshot', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent<string>).data) as ContextSnapshot;
        onSnapshot(parsed);
        onStatusChange?.(true);
      } catch {
        // Ignore malformed SSE payload
      }
    });

    source.addEventListener('error', () => {
      onStatusChange?.(false);
    });
  };

  const disconnect = () => {
    if (source) {
      source.close();
      source = null;
    }
    onStatusChange?.(false);
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      disconnect();
    } else {
      disconnect();
      connect();
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);
  connect();

  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', handleVisibility);
    disconnect();
  };
}
