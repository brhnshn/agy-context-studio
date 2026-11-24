import { useCallback, useEffect, useState } from 'react';
import type { ContextSnapshot, LanguageCode, PluginConfig, UsageHistory } from '../core/types.js';
import { ActionsBar } from './components/ActionsBar.js';
import { BreakdownCard } from './components/BreakdownCard.js';
import { ContextMeterCard } from './components/ContextMeterCard.js';
import { HeaderBar } from './components/HeaderBar.js';
import { HistoryTab } from './components/HistoryTab.js';
import { SettingsTab } from './components/SettingsTab.js';
import { SubagentsTab } from './components/SubagentsTab.js';
import { getTranslations } from './i18n/index.js';
import {
  type ConversationListItem,
  fetchConversations,
  fetchHistory,
  fetchSettings,
  fetchState,
  subscribeToState,
  updateSettings
} from './services/apiClient.js';
import { getHostConversationId } from './services/sidecarBridge.js';
import { GaugeIcon, HistoryIcon, SettingsIcon, UsersIcon } from './utils/icons.js';

type ActiveTab = 'overview' | 'subagents' | 'history' | 'settings';

const INITIAL_CONFIG: PluginConfig = {
  language: 'en',
  hookEnabled: true,
  warningThresholdPct: 70,
  criticalThresholdPct: 85,
  modelOverrides: {}
};

export function App() {
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [config, setConfig] = useState<PluginConfig>(INITIAL_CONFIG);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string>(() => getHostConversationId() ?? '');
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null);
  const [history, setHistory] = useState<UsageHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isHidden, setIsHidden] = useState(() => document.visibilityState === 'hidden');

  const t = getTranslations(config.language);
  const subagents = snapshot?.subagents ?? [];

  const loadSnapshotAndLists = useCallback(async (convId: string) => {
    const [nextSnapshot, nextConvs] = await Promise.all([
      fetchState(convId || null),
      fetchConversations()
    ]);
    setSnapshot(nextSnapshot);
    setConversations(nextConvs);
    if (!convId && nextSnapshot.conversationId) {
      setSelectedConvId(nextSnapshot.conversationId);
    }
  }, []);

  useEffect(() => {
    void fetchSettings()
      .then((cfg) => setConfig(cfg))
      .catch(() => undefined);
    void loadSnapshotAndLists(selectedConvId).catch(() => undefined);
  }, [loadSnapshotAndLists, selectedConvId]);

  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      setIsHidden(hidden);
      if (!hidden) {
        void loadSnapshotAndLists(selectedConvId).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loadSnapshotAndLists, selectedConvId]);

  useEffect(() => {
    const unsubscribe = subscribeToState(
      selectedConvId || null,
      (next) => {
        setSnapshot(next);
      },
      (status) => {
        setConnected(status);
      }
    );
    return unsubscribe;
  }, [selectedConvId]);

  useEffect(() => {
    if (tab !== 'history') {
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    void fetchHistory(7)
      .then((res) => {
        if (!cancelled) {
          setHistory(res);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const handleSaveConfig = async (partial: Partial<PluginConfig>) => {
    const next = await updateSettings(partial);
    setConfig(next);
    await loadSnapshotAndLists(selectedConvId);
  };

  const handleSetLanguage = (nextLang: LanguageCode) => {
    if (nextLang !== config.language) {
      void handleSaveConfig({ language: nextLang });
    }
  };

  return (
    <main className="cs-shell">
      <HeaderBar
        t={t}
        language={config.language}
        conversations={conversations}
        selectedConversationId={selectedConvId || snapshot?.conversationId || ''}
        connected={connected}
        isHidden={isHidden}
        onSelectConversation={(id) => setSelectedConvId(id)}
        onSetLanguage={handleSetLanguage}
        onRefresh={() => void loadSnapshotAndLists(selectedConvId)}
      />

      <nav className="cs-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          className={`cs-tab ${tab === 'overview' ? 'cs-tab-active' : ''}`}
          onClick={() => setTab('overview')}
        >
          <GaugeIcon />
          {t.tabs.overview}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'subagents'}
          className={`cs-tab ${tab === 'subagents' ? 'cs-tab-active' : ''}`}
          onClick={() => setTab('subagents')}
        >
          <UsersIcon />
          {t.tabs.subagents}
          {subagents.length > 0 && <span className="cs-tab-count">{subagents.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          className={`cs-tab ${tab === 'history' ? 'cs-tab-active' : ''}`}
          onClick={() => setTab('history')}
        >
          <HistoryIcon />
          {t.tabs.history}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'settings'}
          className={`cs-tab ${tab === 'settings' ? 'cs-tab-active' : ''}`}
          onClick={() => setTab('settings')}
        >
          <SettingsIcon />
          {t.tabs.settings}
        </button>
      </nav>

      {tab === 'overview' && (
        <div className="cs-panel">
          <ContextMeterCard t={t} snapshot={snapshot} config={config} />
          <BreakdownCard t={t} snapshot={snapshot} />
          <ActionsBar t={t} language={config.language} snapshot={snapshot} />
        </div>
      )}

      {tab === 'subagents' && (
        <div className="cs-panel">
          <SubagentsTab t={t} subagents={subagents} />
        </div>
      )}

      {tab === 'history' && (
        <div className="cs-panel">
          <HistoryTab t={t} history={history} loading={historyLoading} />
        </div>
      )}

      {tab === 'settings' && (
        <SettingsTab t={t} config={config} onSaveConfig={handleSaveConfig} />
      )}
    </main>
  );
}
