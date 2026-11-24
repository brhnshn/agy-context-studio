import { useState } from 'react';
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
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const categories = snapshot?.breakdown.categories ?? [];
  const allBloaters = snapshot?.topBloaters ?? [];
  const visibleBloaters = selectedCategory
    ? allBloaters.filter((item) => item.category === selectedCategory)
    : allBloaters;
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
                  className="cs-stack-segment"
                  style={{
                    width: `${slice.sharePct}%`,
                    backgroundColor: CATEGORY_COLORS[slice.category],
                    opacity: selectedCategory && selectedCategory !== slice.category ? 0.28 : 1
                  }}
                  title={`${t.breakdown.categories[slice.category]}: ~${formatTokens(slice.estimatedTokens)} (${slice.sharePct.toFixed(1)}%)`}
                />
              ))}
          </div>
          <div className="cs-legend">
            {categories.map((slice) => {
              const isSelected = selectedCategory === slice.category;
              return (
                <button
                  key={slice.category}
                  type="button"
                  className={`cs-pill-filter ${isSelected ? 'is-selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    setSelectedCategory((prev) => (prev === slice.category ? null : slice.category))
                  }
                >
                  <span className="cs-dot" style={{ backgroundColor: CATEGORY_COLORS[slice.category] }} />
                  <span>{t.breakdown.categories[slice.category]}</span>
                  <span>~{formatTokens(slice.estimatedTokens)}</span>
                  <span>({slice.sharePct.toFixed(1)}%)</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="cs-empty">{t.breakdown.noSteps}</div>
      )}

      {visibleBloaters.length > 0 && (
        <>
          <div className="cs-card-title" style={{ marginTop: '2px' }}>
            {t.breakdown.bloatersTitle}
          </div>
          <div className="cs-list">
            {visibleBloaters.slice(0, 6).map((item) => (
              <div key={`${item.stepIndex}-${item.category}-${item.label}`} className="cs-list-row">
                <div
                  className="cs-list-bar"
                  style={{
                    width: `${Math.min(100, Math.max(4, item.sharePct))}%`,
                    backgroundColor: CATEGORY_COLORS[item.category]
                  }}
                />
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
