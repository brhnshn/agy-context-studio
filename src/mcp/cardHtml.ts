export const CONTEXT_CARD_URI = 'ui://agy-context-studio/card.html';

export function renderContextCardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Context Studio Card</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--vscode-editorWidget-background, #161d26);
      --fg: var(--vscode-foreground, #e2e8f0);
      --muted: var(--vscode-descriptionForeground, #94a3b8);
      --border: var(--vscode-panel-border, rgba(148, 163, 184, 0.2));
      --track: rgba(148, 163, 184, 0.14);
      --ok: #10b981;
      --warn: #f59e0b;
      --crit: #ef4444;
      --accent: #38bdf8;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: var(--vscode-editorWidget-background, #ffffff);
        --fg: var(--vscode-foreground, #0f172a);
        --muted: var(--vscode-descriptionForeground, #475569);
        --border: var(--vscode-panel-border, rgba(15, 23, 42, 0.14));
        --track: rgba(15, 23, 42, 0.08);
      }
    }
    body {
      margin: 0;
      padding: 12px;
      background: transparent;
      color: var(--fg);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
    }
    .card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 8px;
    }
    .title {
      font-weight: 600;
      font-size: 13px;
    }
    .muted {
      color: var(--muted);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .bar-track {
      height: 8px;
      border-radius: 999px;
      background: var(--track);
      overflow: hidden;
      margin: 8px 0 10px;
    }
    .bar-fill {
      height: 100%;
      width: 0%;
      background: var(--accent);
      transition: width 180ms ease;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      font-variant-numeric: tabular-nums;
    }
    .stat {
      background: var(--track);
      border-radius: 7px;
      padding: 6px 8px;
    }
    .stat-label {
      font-size: 11px;
      color: var(--muted);
    }
    .stat-val {
      font-size: 13px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="row">
      <span class="title" id="model">Context Studio</span>
      <span class="muted" id="pct">-</span>
    </div>
    <div class="muted" id="tokens">Waiting for telemetry...</div>
    <div class="bar-track"><div class="bar-fill" id="fill"></div></div>
    <div class="grid">
      <div class="stat">
        <div class="stat-label">Turn Cache Hit</div>
        <div class="stat-val" id="cache">-</div>
      </div>
      <div class="stat">
        <div class="stat-label">Turns</div>
        <div class="stat-val" id="turns">-</div>
      </div>
      <div class="stat">
        <div class="stat-label">Compactions</div>
        <div class="stat-val" id="compactions">-</div>
      </div>
    </div>
  </div>
  <script>
    (function () {
      function fmt(n) {
        return typeof n === 'number' && Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '-';
      }
      function render(snap) {
        if (!snap || typeof snap !== 'object') return;
        document.getElementById('model').textContent = snap.model || 'Context Studio';
        var limit = snap.modelLimit && snap.modelLimit.contextLimit ? fmt(snap.modelLimit.contextLimit) : '-';
        document.getElementById('tokens').textContent = fmt(snap.totalInputTokens) + ' / ' + limit + ' tokens';
        var pct = typeof snap.usagePct === 'number' ? snap.usagePct : null;
        document.getElementById('pct').textContent = pct !== null ? pct.toFixed(1) + '%' : '-';
        var fill = document.getElementById('fill');
        fill.style.width = pct !== null ? Math.min(100, Math.max(0, pct)) + '%' : '0%';
        fill.style.background = pct >= 85 ? 'var(--crit)' : pct >= 70 ? 'var(--warn)' : 'var(--ok)';
        var cacheRate = typeof snap.turnCacheHitRate === 'number' ? (snap.turnCacheHitRate * 100).toFixed(1) + '%' : '-';
        document.getElementById('cache').textContent = cacheRate;
        document.getElementById('turns').textContent = fmt(snap.turnCount);
        document.getElementById('compactions').textContent = fmt(snap.compactionCount);
      }

      window.addEventListener('message', function (event) {
        var msg = event.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.method === 'ui/notifications/tool-result' && msg.params) {
          render(msg.params.structuredContent || msg.params);
        }
      });

      window.parent.postMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/initialize',
        params: {
          appInfo: { name: 'Context Studio Card', version: '0.1.0' },
          appCapabilities: {},
          protocolVersion: '2026-01-26'
        }
      }, '*');
    })();
  </script>
</body>
</html>
`;
}
