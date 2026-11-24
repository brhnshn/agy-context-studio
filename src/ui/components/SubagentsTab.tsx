import type { SubagentSummary } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';
import { formatPercent, formatTokens } from '../utils/format.js';
import { UsersIcon } from '../utils/icons.js';

interface SubagentsTabProps {
  t: TranslationDict;
  subagents: SubagentSummary[];
}

function SubagentNode({
  node,
  t,
  depth
}: {
  node: SubagentSummary;
  t: TranslationDict;
  depth: number;
}) {
  return (
    <div style={{ marginLeft: depth * 12 }} className="cs-list">
      <div className="cs-list-row">
        <div className="cs-list-main">
          <span className={`cs-badge ${node.status === 'active' ? 'cs-badge-ok' : ''}`}>
            {node.status === 'active' ? t.subagents.statusActive : t.subagents.statusMissing}
          </span>
          <span className="cs-list-label" title={node.conversationId}>
            {node.role || node.typeName || node.conversationId.slice(0, 8)}
          </span>
        </div>
        <div className="cs-list-meta">
          <span>{node.model ?? '-'}</span>
          <span>{formatTokens(node.totalInputTokens)}</span>
          <span>
            {node.turnCount} {t.subagents.turns}
          </span>
          <span>
            {node.turnCount > 0 ? formatPercent(node.cacheHitRate, true) : '-'} {t.subagents.cacheHit}
          </span>
        </div>
      </div>
      {node.children.map((child) => (
        <SubagentNode key={child.conversationId} node={child} t={t} depth={depth + 1} />
      ))}
    </div>
  );
}

export function SubagentsTab({ t, subagents }: SubagentsTabProps) {
  return (
    <section className="cs-card">
      <div className="cs-card-head">
        <span className="cs-card-title">
          <UsersIcon />
          {t.subagents.title}
        </span>
        <span className="cs-badge">{subagents.length}</span>
      </div>
      {subagents.length === 0 ? (
        <div className="cs-empty">{t.subagents.empty}</div>
      ) : (
        <div className="cs-list">
          {subagents.map((item) => (
            <SubagentNode key={item.conversationId} node={item} t={t} depth={0} />
          ))}
        </div>
      )}
    </section>
  );
}
