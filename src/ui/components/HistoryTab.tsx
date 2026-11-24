import type { UsageHistory } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';
import { formatPercent, formatTokens } from '../utils/format.js';
import { HistoryIcon } from '../utils/icons.js';

interface HistoryTabProps {
  t: TranslationDict;
  history: UsageHistory | null;
}

export function HistoryTab({ t, history }: HistoryTabProps) {
  const daily = history?.daily ?? [];
  const maxDayTokens = daily.reduce((max, item) => Math.max(max, item.totalInputTokens), 0);

  return (
    <section className="cs-card">
      <div className="cs-card-head">
        <span className="cs-card-title">
          <HistoryIcon />
          {t.history.title}
        </span>
      </div>

      {!history || history.totals.turns === 0 ? (
        <div className="cs-empty">{t.history.empty}</div>
      ) : (
        <>
          <div className="cs-stats-grid">
            <div className="cs-stat-box">
              <span className="cs-stat-label">{t.history.sessions}</span>
              <span className="cs-stat-val">{history.totals.sessions}</span>
            </div>
            <div className="cs-stat-box">
              <span className="cs-stat-label">{t.history.turns}</span>
              <span className="cs-stat-val">{history.totals.turns}</span>
            </div>
            <div className="cs-stat-box">
              <span className="cs-stat-label">{t.history.totalInput}</span>
              <span className="cs-stat-val">{formatTokens(history.totals.totalInputTokens)}</span>
            </div>
            <div className="cs-stat-box">
              <span className="cs-stat-label">{t.history.cacheSavings}</span>
              <span className="cs-stat-val">{formatPercent(history.totals.cacheHitRate, true)}</span>
            </div>
          </div>

          <svg viewBox="0 0 280 72" width="100%" height="72" aria-label={t.history.title}>
            {daily.map((day, idx) => {
              const barWidth = 28;
              const gap = 12;
              const x = idx * (barWidth + gap) + 6;
              const totalH = maxDayTokens > 0 ? Math.max(2, Math.round((day.totalInputTokens / maxDayTokens) * 52)) : 2;
              const cachedH =
                day.totalInputTokens > 0
                  ? Math.round((day.cacheReadTokens / day.totalInputTokens) * totalH)
                  : 0;
              return (
                <g key={day.date}>
                  <rect
                    x={x}
                    y={56 - totalH}
                    width={barWidth}
                    height={totalH}
                    rx="3"
                    fill="var(--cs-accent)"
                    opacity="0.35"
                  />
                  {cachedH > 0 && (
                    <rect
                      x={x}
                      y={56 - cachedH}
                      width={barWidth}
                      height={cachedH}
                      rx="3"
                      fill="var(--cs-ok)"
                    />
                  )}
                  <text
                    x={x + barWidth / 2}
                    y="69"
                    textAnchor="middle"
                    fontSize="8"
                    fill="var(--cs-muted)"
                  >
                    {day.date.slice(5)}
                  </text>
                </g>
              );
            })}
          </svg>

          <table className="cs-table">
            <thead>
              <tr>
                <th>{t.history.date}</th>
                <th>{t.history.sessions}</th>
                <th>{t.history.turns}</th>
                <th>{t.history.totalInput}</th>
                <th>{t.history.cacheSavings}</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((day) => (
                <tr key={day.date}>
                  <td>{day.date}</td>
                  <td>{day.sessions}</td>
                  <td>{day.turns}</td>
                  <td>{formatTokens(day.totalInputTokens)}</td>
                  <td>{day.turns > 0 ? formatPercent(day.cacheHitRate, true) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
