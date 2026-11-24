import { useEffect, useState } from 'react';
import type { LanguageCode, ModelOptionItem, ModelOverride, PluginConfig } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';
import { fetchModels } from '../services/apiClient.js';
import { copyText } from '../services/sidecarBridge.js';
import { formatTokens } from '../utils/format.js';
import { CheckIcon, CopyIcon, SettingsIcon } from '../utils/icons.js';
import { CustomSelect } from './CustomSelect.js';
import { NumberStepper } from './NumberStepper.js';

interface SettingsTabProps {
  t: TranslationDict;
  config: PluginConfig;
  onSaveConfig: (next: Partial<PluginConfig>) => Promise<void>;
}

const CUSTOM_MODEL_VALUE = '__custom__';

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

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', meta: 'EN' },
  { value: 'tr', label: 'Türkçe', meta: 'TR' }
];

export function SettingsTab({ t, config, onSaveConfig }: SettingsTabProps) {
  const [language, setLanguage] = useState<LanguageCode>(config.language);
  const [hookEnabled, setHookEnabled] = useState(config.hookEnabled);
  const [warningPct, setWarningPct] = useState(config.warningThresholdPct);
  const [criticalPct, setCriticalPct] = useState(config.criticalThresholdPct);
  const [overrides, setOverrides] = useState<Record<string, ModelOverride>>(config.modelOverrides);
  const [models, setModels] = useState<ModelOptionItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(CUSTOM_MODEL_VALUE);
  const [customPattern, setCustomPattern] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLanguage(config.language);
    setHookEnabled(config.hookEnabled);
    setWarningPct(config.warningThresholdPct);
    setCriticalPct(config.criticalThresholdPct);
    setOverrides(config.modelOverrides);
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    void fetchModels()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setModels(items);
        if (items.length > 0) {
          const first = items[0]!;
          setSelectedModel(first.id);
          if (first.contextLimit) {
            setNewLimit(String(first.contextLimit));
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const handleWarningChange = (nextWarn: number) => {
    setWarningPct(nextWarn);
    if (criticalPct <= nextWarn) {
      setCriticalPct(Math.min(99, nextWarn + 5));
    }
  };

  const handleCriticalChange = (nextCrit: number) => {
    const minAllowed = Math.min(99, warningPct + 5);
    setCriticalPct(Math.max(minAllowed, nextCrit));
  };

  const handleModelSelect = (nextValue: string) => {
    setSelectedModel(nextValue);
    if (nextValue === CUSTOM_MODEL_VALUE) {
      setNewLimit('');
      return;
    }
    const found = models.find((item) => item.id === nextValue);
    if (found?.contextLimit) {
      setNewLimit(String(found.contextLimit));
    } else {
      setNewLimit('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveConfig({
        language,
        hookEnabled,
        warningThresholdPct: warningPct,
        criticalThresholdPct: criticalPct,
        modelOverrides: overrides
      });
      showStatus(t.settings.saved);
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = () => {
    const pattern =
      selectedModel === CUSTOM_MODEL_VALUE ? customPattern.trim() : selectedModel.trim();
    const limit = Number(newLimit);
    if (!pattern || !Number.isFinite(limit) || limit <= 0) {
      return;
    }
    setOverrides((prev) => ({
      ...prev,
      [pattern]: { contextLimit: Math.round(limit) }
    }));
    if (selectedModel === CUSTOM_MODEL_VALUE) {
      setCustomPattern('');
    }
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

  const modelSelectOptions = [
    ...models.map((item) => ({
      value: item.id,
      label: item.id,
      meta: item.contextLimit ? formatTokens(item.contextLimit) : '?'
    })),
    {
      value: CUSTOM_MODEL_VALUE,
      label: t.settings.customModelOption
    }
  ];

  const overrideEntries = Object.entries(overrides);
  const safeZoneWidth = Math.max(0, Math.min(100, warningPct));
  const warnZoneWidth = Math.max(0, Math.min(100 - safeZoneWidth, criticalPct - warningPct));
  const critZoneWidth = Math.max(0, 100 - safeZoneWidth - warnZoneWidth);

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

        <div className="cs-settings-grid">
          <div className="cs-setting-tile">
            <span className="cs-setting-label">{t.settings.language}</span>
            <CustomSelect
              id="cs-lang-select"
              ariaLabel={t.settings.language}
              value={language}
              options={LANGUAGE_OPTIONS}
              onChange={(val) => setLanguage(val as LanguageCode)}
              align="right"
            />
          </div>

          <div className="cs-setting-tile">
            <label htmlFor="cs-hook-toggle" className="cs-setting-label">
              {t.settings.hookEnabled}
            </label>
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
        </div>

        <div className="cs-settings-grid">
          <NumberStepper
            id="cs-warn-pct"
            label={t.settings.warningPct}
            value={warningPct}
            min={10}
            max={94}
            step={5}
            suffix="%"
            onChange={handleWarningChange}
          />
          <NumberStepper
            id="cs-crit-pct"
            label={t.settings.criticalPct}
            value={criticalPct}
            min={15}
            max={99}
            step={5}
            suffix="%"
            onChange={handleCriticalChange}
          />
        </div>

        <div className="cs-threshold-preview" aria-hidden="true">
          <div className="cs-zone-ok" style={{ width: `${safeZoneWidth}%` }} />
          <div className="cs-zone-warn" style={{ width: `${warnZoneWidth}%` }} />
          <div className="cs-zone-crit" style={{ width: `${critZoneWidth}%` }} />
        </div>

        <div className="cs-settings-footer">
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

        <div className="cs-override-form">
          <div className="cs-override-select">
            <CustomSelect
              id="cs-model-override-select"
              ariaLabel={t.settings.selectModel}
              value={selectedModel}
              options={modelSelectOptions}
              onChange={handleModelSelect}
              mono
              align="left"
            />
          </div>
          {selectedModel === CUSTOM_MODEL_VALUE && (
            <input
              type="text"
              className="cs-input cs-override-pattern"
              placeholder={t.settings.modelPattern}
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
            />
          )}
          <input
            type="number"
            className="cs-input cs-override-limit"
            placeholder={t.settings.limitPlaceholder}
            value={newLimit}
            onChange={(e) => setNewLimit(e.target.value)}
          />
          <button type="button" className="cs-btn" onClick={handleAddOverride}>
            {t.settings.addOverride}
          </button>
        </div>

        {overrideEntries.length === 0 ? (
          <div className="cs-empty-compact">{t.settings.noOverrides}</div>
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
        <div className="cs-muted-note">{t.settings.mcpDescription}</div>
        <pre className="cs-code">{MCP_CONFIG_SNIPPET}</pre>
      </section>
    </div>
  );
}
