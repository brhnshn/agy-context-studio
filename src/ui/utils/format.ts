import type { BloaterItem, ContextSnapshot, LanguageCode } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';

export function formatTokens(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return Math.round(value).toString();
}

export function formatExactNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return Math.round(value).toLocaleString('en-US');
}

export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return '-';
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${Math.round(bytes)} B`;
}

export function formatPercent(ratioOrPct: number | null | undefined, isRatio = false): string {
  if (typeof ratioOrPct !== 'number' || !Number.isFinite(ratioOrPct)) {
    return '-';
  }
  const pct = isRatio ? ratioOrPct * 100 : ratioOrPct;
  return `${pct.toFixed(1)}%`;
}

export function formatShortTime(mtimeMs: number, lang: LanguageCode): string {
  if (!Number.isFinite(mtimeMs) || mtimeMs <= 0) {
    return '';
  }
  const date = new Date(mtimeMs);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  if (sameDay) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export function formatBloaterLabel(item: BloaterItem, t: TranslationDict): string {
  const kindPrefix = item.stepKind ? t.breakdown.stepKinds[item.stepKind] : null;

  if (item.toolCounts && item.toolCounts.length > 0) {
    const countsText = item.toolCounts
      .map((entry) => (entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name))
      .join(', ');
    const targetsText =
      item.targets && item.targets.length > 0 ? ` (${item.targets.join(', ')})` : '';
    return kindPrefix ? `${kindPrefix} · ${countsText}${targetsText}` : `${countsText}${targetsText}`;
  }

  if (item.stepKind === 'thinking') {
    return `${t.breakdown.stepKinds.thinking} #${item.stepIndex}`;
  }

  if (item.stepKind === 'system') {
    return `${t.breakdown.stepKinds.system} #${item.stepIndex}`;
  }

  if (item.stepKind === 'tool_result' && item.toolName) {
    return `${t.breakdown.stepKinds.tool_result} · ${item.toolName}`;
  }

  return kindPrefix ? `${kindPrefix} · ${item.label}` : item.label;
}

export function buildMarkdownReport(snapshot: ContextSnapshot, lang: LanguageCode): string {
  const limitLabel = snapshot.modelLimit.contextLimit
    ? formatExactNumber(snapshot.modelLimit.contextLimit)
    : '-';
  const usageLabel = snapshot.usagePct !== null ? `${snapshot.usagePct.toFixed(1)}%` : '-';
  const cacheLabel = formatPercent(snapshot.turnCacheHitRate, true);

  const lines = [
    lang === 'tr' ? '## Bağlam Durumu Raporu' : '## Context Health Report',
    `- **Session:** \`${snapshot.conversationId || '-'}\``,
    `- **Model:** \`${snapshot.model ?? '-'}\``,
    `- **Context Fill:** ${formatExactNumber(snapshot.totalInputTokens)} / ${limitLabel} (${usageLabel})`,
    `- **Turn Cache Hit:** ${cacheLabel} (${formatExactNumber(snapshot.cacheReadTokens)} cached / ${formatExactNumber(snapshot.uncachedInputTokens)} uncached)`,
    `- **Turns / Compactions:** ${snapshot.turnCount} / ${snapshot.compactionCount}`
  ];

  if (snapshot.topBloaters.length > 0) {
    lines.push('', lang === 'tr' ? '### En Büyük Adımlar (~tahmini)' : '### Top Context Bloaters (~estimate)');
    for (const item of snapshot.topBloaters.slice(0, 5)) {
      lines.push(
        `- [${item.category}] ${item.label} — ~${formatTokens(item.estimatedTokens)} tokens (${formatBytes(item.bytes)}, ${item.sharePct.toFixed(1)}%)`
      );
    }
  }

  return lines.join('\n');
}

export function buildSmartHandoffPrompt(lang: LanguageCode): string {
  if (lang === 'tr') {
    return [
      'Yeni ve temiz bir oturuma sıfır kayıpla geçebilmem için mevcut oturumun kısa ve öz bir `<HANDOFF_PROMPT>` özetini üret.',
      'Şunları mutlaka dahil et:',
      '1. Tamamlanan işler ve doğrulanan dosya yolları / komut sonuçları',
      '2. Alınan mimari/teknik kararlar ve kısıtlar',
      '3. Açık kalan adımlar ve sıradaki ilk somut görev'
    ].join('\n');
  }
  return [
    'Generate a compact `<HANDOFF_PROMPT>` so I can continue cleanly in a fresh session with zero context loss.',
    'Include:',
    '1. Completed work and verified file paths / test results',
    '2. Key technical decisions and active constraints',
    '3. Remaining tasks and the exact next action to take'
  ].join('\n');
}

export function buildCompactCheckpointPrompt(lang: LanguageCode): string {
  if (lang === 'tr') {
    return 'Şu ana kadarki ilerlemeyi, değişen dosyaları ve kalan adımları tek bir kısa kontrol noktası özeti halinde çıkar.';
  }
  return 'Summarize our progress so far, modified files, and remaining steps into one concise checkpoint summary.';
}
