import { useEffect, useState } from 'react';
import type { LanguageCode, ModelOverride, PluginConfig } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';
import { copyText } from '../services/sidecarBridge.js';
import { CheckIcon, CopyIcon, SettingsIcon } from '../utils/icons.js';

interface SettingsTabProps {
  t: TranslationDict;
  config: PluginConfig;
  onSaveConfig: (next: Partial<PluginConfig>) => Promise<void>;
}

const MCP_CONFIG_SNIPPET = JSON.stringify(
  {
    mcpServers: {
      'agy-context-studio': {
        command: 'node',
        args: ['mcp/server.mjs']
      }
    }
  },
  null,
  2
);

export function SettingsTab({ t, config, onSaveConfig }: SettingsTabProps) {
  const [language, setLanguage] = useState<LanguageCode>(config.language);
  const [hookEnabled, setHookEnabled] = useState(config.hookEnabled);
  const [warningPct, setWarningPct] = useState(String(config.warningThresholdPct));
  const [criticalPct, setCriticalPct] = useState(String(config.criticalThresholdPct));
  const [overrides, setOverrides] = useState<Record<string, ModelOverride>>(config.modelOverrides);
  const [newPattern, setNewPattern] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLanguage(config.language);
    setHookEnabled(config.hookEnabled);
    setWarningPct(String(config.warningThresholdPct));
    setCriticalPct(String(config.criticalThresholdPct));
    setOverrides(config.modelOverrides);
  }, [config]);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveConfig({
        language,
        hookEnabled,
        warningThresholdPct: Number(warningPct) || config.warningThresholdPct,
        criticalThresholdPct: Number(criticalPct) || config.criticalThresholdPct,
        modelOverrides: overrides
      });
      showStatus(t.settings.saved);
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = () => {
    const pattern = newPattern.trim();
    const limit = Number(newLimit);
    if (!pattern || !Number.isFinite(limit) || limit <= 0) {
      return;
    }
    setOverrides((prev) => ({
      ...prev,
      [pattern]: { contextLimit: Math.round(limit) }
    }));
    setNewPattern('');
    setNewLimit('');
  };

  const handleRemoveOverride = (pattern: string) => {
    setOverrides((prev) => {
      const copy = { ...prev };
      delete copy[pattern];
      return copy;
    });
  };

  const handleCopyMcp = async () => {
    const ok = await copyText(MCP_CONFIG_SNIPPET);
    if (ok) {
      showStatus(t.settings.mcpCopied);
    }
  };

  const overrideEntries = Object.entries(overrides);

  return (
    <div className="cs-panel">
      <section className="cs-card">
        <div className="cs-card-head">
          <span className="cs-card-title">
            <SettingsIcon />
            {t.settings.title}
          </span>
          {statusMsg && (
            <span className="cs-feedback">
              <CheckIcon />
              {statusMsg}
            </span>
          )}
        </div>

        <div className="cs-form-row">
          <label htmlFor="cs-lang-select">{t.settings.language}</label>
          <select
            id="cs-lang-select"
            className="cs-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          >
            <option value="en">English (EN)</option>
            <option value="tr">Türkçe (TR)</option>
          </select>
        </div>

        <div className="cs-form-row">
          <label htmlFor="cs-hook-toggle">{t.settings.hookEnabled}</label>
          <label className="cs-switch">
            <input
              id="cs-hook-toggle"
              type="checkbox"
              checked={hookEnabled}
              onChange={(e) => setHookEnabled(e.target.checked)}
            />
            <span className="cs-switch-track" />
          </label>
        </div>

        <div className="cs-form-row">
          <label htmlFor="cs-warn-pct">{t.settings.warningPct}</label>
          <input
            id="cs-warn-pct"
            type="number"
            min={10}
            max={98}
            className="cs-input"
            style={{ width: '80px' }}
            value={warningPct}
            onChange={(e) => setWarningPct(e.target.value)}
          />
        </div>

        <div className="cs-form-row">
          <label htmlFor="cs-crit-pct">{t.settings.criticalPct}</label>
          <input
            id="cs-crit-pct"
            type="number"
            min={15}
            max={99}
            className="cs-input"
            style={{ width: '80px' }}
            value={criticalPct}
            onChange={(e) => setCriticalPct(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            className="cs-btn cs-btn-primary"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {t.settings.save}
          </button>
        </div>
      </section>

      <section className="cs-card">
        <div className="cs-card-head">
          <span className="cs-card-title">{t.settings.overridesTitle}</span>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="cs-input"
            style={{ flex: 1, minWidth: '140px' }}
            placeholder={t.settings.modelPattern}
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
          />
          <input
            type="number"
            className="cs-input"
            style={{ width: '130px' }}
            placeholder={t.settings.contextLimit}
            value={newLimit}
            onChange={(e) => setNewLimit(e.target.value)}
          />
          <button type="button" className="cs-btn" onClick={handleAddOverride}>
            {t.settings.addOverride}
          </button>
        </div>

        {overrideEntries.length === 0 ? (
          <div className="cs-empty">{t.settings.noOverrides}</div>
        ) : (
          <div className="cs-list">
            {overrideEntries.map(([pattern, entry]) => (
              <div key={pattern} className="cs-list-row">
                <span className="cs-list-label">{pattern}</span>
                <div className="cs-list-meta">
                  <span>{entry.contextLimit.toLocaleString('en-US')}</span>
                  <button
                    type="button"
                    className="cs-btn"
                    onClick={() => handleRemoveOverride(pattern)}
                  >
                    {t.settings.remove}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="cs-card">
        <div className="cs-card-head">
          <span className="cs-card-title">{t.settings.mcpTitle}</span>
          <button type="button" className="cs-btn" onClick={() => void handleCopyMcp()}>
            <CopyIcon />
            {t.settings.copyMcpConfig}
          </button>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--cs-muted)' }}>{t.settings.mcpDescription}</div>
        <pre className="cs-code">{MCP_CONFIG_SNIPPET}</pre>
      </section>
    </div>
  );
}
