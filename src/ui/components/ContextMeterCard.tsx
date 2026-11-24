import type { ContextSnapshot, PluginConfig } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';
import { formatExactNumber, formatPercent, formatTokens } from '../utils/format.js';
import { GaugeIcon } from '../utils/icons.js';

interface ContextMeterCardProps {
  t: TranslationDict;
  snapshot: ContextSnapshot | null;
  config: PluginConfig;
}

export function ContextMeterCard({ t, snapshot, config }: ContextMeterCardProps) {
  if (!snapshot || snapshot.status === 'missing') {
    return (
      <section className="cs-card">
        <div className="cs-card-head">
          <span className="cs-card-title">
            <GaugeIcon />
            {t.meter.title}
          </span>
          <span className="cs-badge">-</span>
        </div>
        <div className="cs-empty">{t.meter.noSession}</div>
      </section>
    );
  }

  const limit = snapshot.modelLimit.contextLimit;
  const usagePct = snapshot.usagePct;
  const clampedWidth = usagePct !== null ? Math.min(100, Math.max(0, usagePct)) : 0;
  const cachedShare =
    snapshot.totalInputTokens > 0
      ? Math.min(100, (snapshot.cacheReadTokens / snapshot.totalInputTokens) * 100)
      : 0;
  const uncachedShare = Math.max(0, 100 - cachedShare);

  let badgeClass = 'cs-badge';
  let fillColor = 'var(--cs-accent)';
  if (usagePct !== null) {
    if (usagePct >= config.criticalThresholdPct) {
      badgeClass = 'cs-badge cs-badge-crit';
      fillColor = 'var(--cs-crit)';
    } else if (usagePct >= config.warningThresholdPct) {
      badgeClass = 'cs-badge cs-badge-warn';
      fillColor = 'var(--cs-warn)';
    } else {
      badgeClass = 'cs-badge cs-badge-ok';
      fillColor = 'var(--cs-ok)';
    }
  }

  return (
    <section className="cs-card">
      <div className="cs-card-head">
        <span className="cs-card-title">
          <GaugeIcon />
          {t.meter.title}
        </span>
        <span className="cs-badge cs-badge-mono">{snapshot.model ?? '-'}</span>
      </div>

      <div className="cs-hero-row">
        <div>
          <span className="cs-hero-value">{formatExactNumber(snapshot.totalInputTokens)}</span>{' '}
          <span className="cs-hero-sub">
            / {limit ? formatExactNumber(limit) : t.meter.unknownModel}
          </span>
        </div>
        <span className={badgeClass}>
          {usagePct !== null ? `${usagePct.toFixed(1)}%` : '-'}
        </span>
      </div>

      <div className="cs-meter-wrap">
        <div
          className="cs-meter-track"
          role="progressbar"
          aria-valuenow={clampedWidth}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="cs-meter-fill-group" style={{ width: `${clampedWidth}%` }}>
            {cachedShare > 0 && (
              <div
                className="cs-meter-cached"
                style={{ width: `${cachedShare}%`, backgroundColor: fillColor }}
                title={`${formatExactNumber(snapshot.cacheReadTokens)} cached`}
              />
            )}
            {uncachedShare > 0 && (
              <div
                className="cs-meter-uncached"
                style={{ width: `${uncachedShare}%`, backgroundColor: fillColor }}
                title={`${formatExactNumber(snapshot.uncachedInputTokens)} uncached`}
              />
            )}
          </div>
          {snapshot.compactionPct !== null && (
            <div
              className="cs-meter-marker"
              style={{ left: `${Math.min(99, Math.max(1, snapshot.compactionPct))}%` }}
              title={`${t.meter.compactionMarker}${snapshot.compactionPct}%`}
            />
          )}
        </div>
        <div className="cs-meter-caption">
          <span>
            {formatTokens(snapshot.cacheReadTokens)} cached · {formatTokens(snapshot.uncachedInputTokens)} uncached
          </span>
          {snapshot.compactionPct !== null && (
            <span>
              {t.meter.compactionMarker}
              {snapshot.compactionPct}%
            </span>
          )}
        </div>
      </div>

      <div className="cs-kpi-grid">
        <div className="cs-stat-box">
          <span className="cs-stat-label">{t.meter.turnCacheHit}</span>
          <span className="cs-stat-val">
            {snapshot.turnCount > 0 ? formatPercent(snapshot.turnCacheHitRate, true) : '-'}
          </span>
        </div>
        <div className="cs-stat-box">
          <span className="cs-stat-label">{t.meter.sessionCacheHit}</span>
          <span className="cs-stat-val">
            {snapshot.turnCount > 0 ? formatPercent(snapshot.cumulativeCacheHitRate, true) : '-'}
          </span>
        </div>
        <div className="cs-stat-box">
          <span className="cs-stat-label">{t.meter.outputTokens}</span>
          <span className="cs-stat-val">
            {snapshot.turnCount > 0 ? formatTokens(snapshot.outputTokens) : '-'}
          </span>
        </div>
        <div className="cs-stat-box">
          <span className="cs-stat-label">{t.meter.velocity}</span>
          <span className="cs-stat-val">
            {snapshot.velocityTokensPerTurn !== null
              ? `${snapshot.velocityTokensPerTurn >= 0 ? '+' : ''}${formatTokens(snapshot.velocityTokensPerTurn)}${t.meter.tokensPerTurn}`
              : '-'}
          </span>
        </div>
        <div className="cs-stat-box">
          <span className="cs-stat-label">{t.meter.turns}</span>
          <span className="cs-stat-val">{snapshot.turnCount}</span>
        </div>
        <div className="cs-stat-box">
          <span className="cs-stat-label">{t.meter.compactions}</span>
          <span className="cs-stat-val">{snapshot.compactionCount}</span>
        </div>
      </div>
    </section>
  );
}
