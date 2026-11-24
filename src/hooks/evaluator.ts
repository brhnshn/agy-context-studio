import type {
  ContextSnapshot,
  HookSessionState,
  LanguageCode,
  PluginConfig
} from '../core/types.js';

export interface PostInvocationHookPayload {
  conversationId?: string;
  transcriptPath?: string;
  modelName?: string;
  invocationNum?: number;
}

export interface HookOutputPayload {
  injectSteps?: Array<{
    systemMessage: {
      systemMessage: '';
      metadata: {
        user_markdown: string;
      };
    };
  }>;
}

export interface EvaluationResult {
  shouldNotify: boolean;
  level: 'none' | 'warning' | 'critical';
  nextSessionState: HookSessionState;
  output: HookOutputPayload;
}

function formatNum(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function formatAlertMarkdown(
  level: 'warning' | 'critical',
  snapshot: ContextSnapshot,
  lang: LanguageCode
): string {
  const pctText = snapshot.usagePct !== null ? `${snapshot.usagePct.toFixed(1)}%` : '-';
  const limitText = snapshot.modelLimit.contextLimit
    ? formatNum(snapshot.modelLimit.contextLimit)
    : '-';
  const usedText = formatNum(snapshot.totalInputTokens);
  const cachePct = `${(snapshot.turnCacheHitRate * 100).toFixed(1)}%`;
  const topBloater = snapshot.topBloaters[0];

  if (lang === 'tr') {
    const heading =
      level === 'critical'
        ? `**Context Studio — Kritik Bağlam Eşiği (${pctText})**`
        : `**Context Studio — Bağlam Uyarısı (${pctText})**`;
    const lines = [
      heading,
      `- Doluluk: \`${usedText} / ${limitText}\` token (\`${snapshot.model ?? '-'}\`) · Tur önbellek isabeti: \`${cachePct}\``
    ];
    if (topBloater) {
      lines.push(
        `- En büyük adım (~tahmini): \`${topBloater.label}\` (~${formatNum(topBloater.estimatedTokens)} token)`
      );
    }
    lines.push(
      level === 'critical'
        ? '- Öneri: Context Studio üzerinden **Akıllı Devir** başlatın veya `/compact` çalıştırın.'
        : '- Öneri: Context Studio yan panelinden büyük adımları kontrol edin veya özet noktası alın.'
    );
    return lines.join('\n');
  }

  const heading =
    level === 'critical'
      ? `**Context Studio — Critical Context Threshold (${pctText})**`
      : `**Context Studio — Context Warning (${pctText})**`;
  const lines = [
    heading,
    `- Fill: \`${usedText} / ${limitText}\` tokens (\`${snapshot.model ?? '-'}\`) · Turn cache hit: \`${cachePct}\``
  ];
  if (topBloater) {
    lines.push(
      `- Largest step (~estimate): \`${topBloater.label}\` (~${formatNum(topBloater.estimatedTokens)} tokens)`
    );
  }
  lines.push(
    level === 'critical'
      ? '- Next step: Trigger **Smart Handoff** in Context Studio or run `/compact`.'
      : '- Next step: Inspect top bloaters in the Context Studio sidecar or create a checkpoint.'
  );
  return lines.join('\n');
}

export function evaluateThresholdAlert(
  snapshot: ContextSnapshot,
  config: PluginConfig,
  prevSessionState?: HookSessionState,
  nowIso = new Date().toISOString()
): EvaluationResult {
  const prevLevel = prevSessionState?.lastWarnedLevel ?? 'none';

  if (!config.hookEnabled || snapshot.status === 'missing' || snapshot.usagePct === null) {
    return {
      shouldNotify: false,
      level: 'none',
      nextSessionState: {
        lastWarnedLevel: prevLevel,
        lastInputTokens: snapshot.totalInputTokens,
        lastUpdatedAt: nowIso
      },
      output: {}
    };
  }

  let level: 'none' | 'warning' | 'critical' = 'none';
  if (snapshot.usagePct >= config.criticalThresholdPct) {
    level = 'critical';
  } else if (snapshot.usagePct >= config.warningThresholdPct) {
    level = 'warning';
  }

  // Reset warning state if compaction or a shorter session dropped usage below warning threshold
  if (level === 'none') {
    return {
      shouldNotify: false,
      level: 'none',
      nextSessionState: {
        lastWarnedLevel: 'none',
        lastInputTokens: snapshot.totalInputTokens,
        lastUpdatedAt: nowIso
      },
      output: {}
    };
  }

  const alreadyNotified =
    (level === 'warning' && (prevLevel === 'warning' || prevLevel === 'critical')) ||
    (level === 'critical' && prevLevel === 'critical');

  if (alreadyNotified) {
    return {
      shouldNotify: false,
      level,
      nextSessionState: {
        lastWarnedLevel: prevLevel,
        lastInputTokens: snapshot.totalInputTokens,
        lastUpdatedAt: nowIso
      },
      output: {}
    };
  }

  const markdown = formatAlertMarkdown(level, snapshot, config.language);
  return {
    shouldNotify: true,
    level,
    nextSessionState: {
      lastWarnedLevel: level,
      lastInputTokens: snapshot.totalInputTokens,
      lastUpdatedAt: nowIso
    },
    output: {
      injectSteps: [
        {
          systemMessage: {
            systemMessage: '',
            metadata: {
              user_markdown: markdown
            }
          }
        }
      ]
    }
  };
}
