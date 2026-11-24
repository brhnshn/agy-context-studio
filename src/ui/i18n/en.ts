export const en = {
  appTitle: 'Context Studio',
  tabs: {
    overview: 'Overview',
    subagents: 'Subagents',
    history: '7-Day History',
    settings: 'Settings'
  },
  header: {
    refresh: 'Refresh',
    sessionPlaceholder: 'Latest session',
    liveConnected: 'Live',
    pausedHidden: 'Paused'
  },
  meter: {
    title: 'Context Window',
    unknownModel: 'Unknown limit',
    compactionMarker: 'Compaction ~',
    turnCacheHit: 'Turn Cache Hit',
    sessionCacheHit: 'Session Cache Hit',
    outputTokens: 'Output (Turn)',
    velocity: 'Velocity',
    compactions: 'Compactions',
    turns: 'Turns',
    tokensPerTurn: '/turn',
    noSession: 'No active transcript found yet.'
  },
  breakdown: {
    title: 'Proportional Breakdown (~estimate)',
    estimateNote: 'Estimated proportionally from step payload bytes',
    bloatersTitle: 'Top Context Bloaters',
    noSteps: 'No step payload data recorded yet.',
    categories: {
      user: 'User',
      assistant: 'Assistant',
      thinking: 'Thinking',
      tools: 'Tools',
      system: 'System'
    }
  },
  actions: {
    title: 'Quick Actions (0 Background Tokens)',
    smartHandoff: 'Smart Handoff',
    compactCheckpoint: 'Compact Checkpoint',
    copyReport: 'Copy Markdown Report',
    sentToAgent: 'Prompt sent to active agent.',
    copiedFallback: 'Bridge unavailable — prompt copied to clipboard.',
    reportCopied: 'Markdown report copied to clipboard.'
  },
  subagents: {
    title: 'Spawned Subagents',
    empty: 'No subagents spawned in this session.',
    statusActive: 'Active',
    statusMissing: 'Missing',
    turns: 'turns',
    cacheHit: 'cache'
  },
  history: {
    title: 'Last 7 Days',
    sessions: 'Sessions',
    turns: 'Turns',
    totalInput: 'Total Input',
    cacheSavings: 'Cache Hit',
    date: 'Date',
    loading: 'Loading 7-day history...',
    empty: 'No usage history in the selected window.'
  },
  settings: {
    title: 'Plugin Settings',
    language: 'Language',
    hookEnabled: 'PostInvocation Threshold Alerts (0 Model Tokens)',
    warningPct: 'Warning Threshold (%)',
    criticalPct: 'Critical Threshold (%)',
    save: 'Save Settings',
    saved: 'Settings saved.',
    overridesTitle: 'Model Context Limit Overrides',
    modelPattern: 'Model ID or prefix',
    contextLimit: 'Context limit (tokens)',
    addOverride: 'Add Override',
    remove: 'Remove',
    noOverrides: 'No custom overrides configured.',
    mcpTitle: 'Opt-In MCP App (Layer 3B)',
    mcpDescription:
      'Disabled by default for 0-token overhead. Enabling registers get_context_health (~350 schema tokens/turn) and renders an inline ui:// card in chat.',
    copyMcpConfig: 'Copy mcp_config.json snippet',
    mcpCopied: 'MCP config snippet copied.'
  }
} as const;

export type TranslationDict = typeof en;
