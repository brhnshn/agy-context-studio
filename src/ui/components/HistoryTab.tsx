import { useState } from 'react';
import type { UsageHistory } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';
import { formatPercent, formatTokens } from '../utils/format.js';
import { HistoryIcon } from '../utils/icons.js';

interface HistoryTabProps {
  t: TranslationDict;
  history: UsageHistory | null;
  loading?: boolean;
}

export function HistoryTab({ t, history, loading = false }: HistoryTabProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const daily = history?.daily ?? [];
  const maxDayTokens = daily.reduce((max, item) => Math.max(max, item.totalInputTokens), 0);
  const activeDay = daily.find((d) => d.date === hoveredDate) ?? null;

  return (
    <section className="cs-card">
      <div className="cs-card-head">
        <span className="cs-card-title">
          <HistoryIcon />
          {t.history.title}
        </span>
        {activeDay && (
          <span className="cs-badge cs-badge-mono">
            {activeDay.date} · {formatTokens(activeDay.totalInputTokens)} ·{' '}
            {activeDay.turns > 0 ? formatPercent(activeDay.cacheHitRate, true) : '-'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="cs-empty">{t.history.loading}</div>
      ) : !history || history.totals.turns === 0 ? (
        <div className="cs-empty">{t.history.empty}</div>
      ) : (
        <>
          <div className="cs-kpi-grid">
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

          <div className="cs-chart-box">
            <svg viewBox="0 0 280 78" width="100%" height="84" aria-label={t.history.title}>
              <line x1="4" y1="16" x2="276" y2="16" stroke="var(--cs-border)" strokeDasharray="2 3" />
              <line x1="4" y1="38" x2="276" y2="38" stroke="var(--cs-border)" strokeDasharray="2 3" />
              <line x1="4" y1="60" x2="276" y2="60" stroke="var(--cs-border)" />
              {daily.map((day, idx) => {
                const barWidth = 26;
                const gap = 13;
                const x = idx * (barWidth + gap) + 8;
                const totalH =
                  maxDayTokens > 0 && day.totalInputTokens > 0
                    ? Math.max(3, Math.round((day.totalInputTokens / maxDayTokens) * 50))
                    : 2;
                const cachedH =
                  day.totalInputTokens > 0
                    ? Math.round((day.cacheReadTokens / day.totalInputTokens) * totalH)
                    : 0;
                const dimmed = hoveredDate !== null && hoveredDate !== day.date;
                return (
                  <g
                    key={day.date}
                    className="cs-chart-bar"
                    style={{ opacity: dimmed ? 0.45 : 1 }}
                    onMouseEnter={() => setHoveredDate(day.date)}
                    onMouseLeave={() => setHoveredDate(null)}
                  >
                    <rect
                      x={x}
                      y={60 - totalH}
                      width={barWidth}
                      height={totalH}
                      rx="3"
                      fill="var(--cs-accent)"
                      opacity="0.35"
                    />
                    {cachedH > 0 && (
                      <rect
                        x={x}
                        y={60 - cachedH}
                        width={barWidth}
                        height={cachedH}
                        rx="3"
                        fill="var(--cs-ok)"
                      />
                    )}
                    <text
                      x={x + barWidth / 2}
                      y="73"
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
          </div>

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
                <tr
                  key={day.date}
                  className={hoveredDate === day.date ? 'is-active' : ''}
                  onMouseEnter={() => setHoveredDate(day.date)}
                  onMouseLeave={() => setHoveredDate(null)}
                >
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
