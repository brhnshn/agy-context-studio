import type { CategoryKey, ContextSnapshot } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';
import { formatBytes, formatTokens } from '../utils/format.js';
import { LayersIcon } from '../utils/icons.js';

interface BreakdownCardProps {
  t: TranslationDict;
  snapshot: ContextSnapshot | null;
}

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  user: 'var(--cs-cat-user)',
  assistant: 'var(--cs-cat-assistant)',
  thinking: 'var(--cs-cat-thinking)',
  tools: 'var(--cs-cat-tools)',
  system: 'var(--cs-cat-system)'
};

export function BreakdownCard({ t, snapshot }: BreakdownCardProps) {
  const categories = snapshot?.breakdown.categories ?? [];
  const bloaters = snapshot?.topBloaters ?? [];
  const hasBytes = (snapshot?.breakdown.totalBytes ?? 0) > 0;

  return (
    <section className="cs-card">
      <div className="cs-card-head">
        <span className="cs-card-title">
          <LayersIcon />
          {t.breakdown.title}
        </span>
      </div>

      {hasBytes ? (
        <>
          <div className="cs-stack-bar" title={t.breakdown.estimateNote}>
            {categories
              .filter((slice) => slice.sharePct > 0)
              .map((slice) => (
                <div
                  key={slice.category}
                  style={{
                    width: `${slice.sharePct}%`,
                    backgroundColor: CATEGORY_COLORS[slice.category]
                  }}
                  title={`${t.breakdown.categories[slice.category]}: ~${formatTokens(slice.estimatedTokens)} (${slice.sharePct.toFixed(1)}%)`}
                />
              ))}
          </div>
          <div className="cs-legend">
            {categories.map((slice) => (
              <span key={slice.category} className="cs-legend-item">
                <span className="cs-dot" style={{ backgroundColor: CATEGORY_COLORS[slice.category] }} />
                <span>{t.breakdown.categories[slice.category]}:</span>
                <span>~{formatTokens(slice.estimatedTokens)}</span>
                <span>({slice.sharePct.toFixed(1)}%)</span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="cs-empty">{t.breakdown.noSteps}</div>
      )}

      {bloaters.length > 0 && (
        <>
          <div className="cs-card-title" style={{ marginTop: '4px' }}>
            {t.breakdown.bloatersTitle}
          </div>
          <div className="cs-list">
            {bloaters.slice(0, 6).map((item) => (
              <div key={`${item.stepIndex}-${item.category}-${item.label}`} className="cs-list-row">
                <div className="cs-list-main">
                  <span
                    className="cs-dot"
                    style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                  />
                  <span className="cs-list-label" title={item.label}>
                    {item.label}
                  </span>
                </div>
                <div className="cs-list-meta">
                  <span>~{formatTokens(item.estimatedTokens)}</span>
                  <span>{formatBytes(item.bytes)}</span>
                  <span>{item.sharePct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
