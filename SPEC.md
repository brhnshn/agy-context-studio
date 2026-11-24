# SPEC.md — agy-context-studio Technical Specification

## 1. Goals & Core Principles
`agy-context-studio` gives Google Antigravity users real-time visibility and practical control over their active LLM context window without consuming model tokens to monitor itself.

- **Zero-Token Core:** Live monitoring, prompt cache diagnostics, top-bloater inspection, threshold alerts, and Sidecar Handoff/Summarize triggers incur **0 model token overhead**.
- **Local-First & Read-Only Ingestion:** Reads local Antigravity transcript logs and plugin state on disk; makes zero external network calls.
- **Zero-Dependency Distribution:** Ships pre-bundled ESM outputs and static UI assets so `agy plugin install` requires no `npm install` or Python setup on Windows, macOS, or Linux.
- **Modular 3-Option Architecture:** Combines passive observation, automatic threshold alerts, and interactive management in toggleable layers.

---

## 2. Plugin Directory Layout
Installed/linked under `~/.gemini/config/plugins/agy-context-studio/`:

```text
agy-context-studio/
├── plugin.json                        # Plugin manifest (name, displayName, description, logo, suggestedPrompts)
├── assets/
│   └── logo.svg                       # Square high-contrast SVG logo
├── sidecars/
│   └── agy-context-studio/
│       ├── sidecar.json               # has_web_ui: true, SIDECAR_UI_ENTRYPOINT_AUX_PANE
│       ├── server.mjs                 # Bundled zero-dependency Node ESM HTTP + SSE server
│       └── public/                    # Built React + Vite static Web UI
├── hooks.json                         # PostInvocation hook registration
├── hooks/
│   └── post-invocation.mjs            # Bundled zero-dependency Node ESM hook handler
└── mcp/                               # Optional / opt-in MCP App module (disabled by default)
    ├── mcp_config.template.json
    └── server.mjs
```

---

## 3. Data Ingestion & Telemetry Engine (`src/core/`)

### 3.1 Primary Data Source
Reads Antigravity session transcripts from:
- `~/.gemini/antigravity/brain/<conversationId>/.system_generated/logs/transcript.jsonl` (and discovers related subagent transcripts via `invoke_subagent` step references or conversation metadata).
- Supports configurable Antigravity root override (`ANTIGRAVITY_HOME` / `~/.gemini/antigravity`) and cross-platform path resolution.

### 3.2 Exact Fields Extracted
From `PLANNER_RESPONSE` and tool/user steps in `transcript.jsonl`:
- `model` (string)
- `input_tokens` (exact per-turn context fill)
- `cache_read_tokens` (exact per-turn prompt cache hit)
- `output_tokens` (exact generated tokens)
- `tool_calls` (name, argument byte size, matched tool result byte size)
- `created_at` (ISO timestamp for velocity/history)

### 3.3 Incremental Parsing & Live Streaming
- **Byte-Offset Reader:** Tracks last-read byte offset and file `mtime`/size per `transcript.jsonl` so long conversations do not re-parse from byte 0 on every turn. Falls back to full re-parse if file shrinks/rotates.
- **Event-Driven Updates:** Uses `fs.watch` with debounce + SSE (`/api/events`) to push snapshots to the Sidecar UI.
- **Visibility Gating:** Sidecar UI pauses/throttles refresh when the auxiliary pane is hidden (`document.visibilityState === 'hidden'`).

### 3.4 Model Limit Registry & Overrides
- Ships a built-in model limit catalog (context window ceiling + expected auto-compaction trigger threshold) matched by model ID / family prefix.
- Supports user overrides in `${PLUGIN_DATA}/config.json` (`modelOverrides`) and gracefully displays `-` / unknown ceiling if an unrecognized model has no override.

### 3.5 Proportional Category Attribution & Top Bloaters
- **Strict Honesty:** Total `input_tokens` and `cache_read_tokens` are exact. Category breakdown (User, Assistant, Thinking, Tool Calls/Results, System/Injected) is computed proportionally from step payload byte/char weights and **explicitly labeled in the UI as an estimate (`~`)**.
- **Top Bloaters:** Ranks the largest individual tool results, file reads, or message steps in the active session so users immediately see what inflated the context.

### 3.6 Subagents & 7-Day Local History
- **Subagent Aggregation:** Detects spawned subagents (`invoke_subagent`) in the active conversation and displays per-subagent token summaries alongside the main agent.
- **7-Day History:** Aggregates lightweight daily session summaries (`${PLUGIN_DATA}/history.json` or cached transcript scan) showing token volume and cache savings across the last 7 days.

---

## 4. The 3 Modular Options

### Option 1 — Live Sidecar Web UI Monitor (Default: ON · 0 Tokens)
Registered via `sidecars/agy-context-studio/sidecar.json` with `has_web_ui: true` and `entrypoint: "SIDECAR_UI_ENTRYPOINT_AUX_PANE"`.
- **Top Summary Bar:** `input_tokens / limit` progress bar, percentage, compaction threshold marker, turn & cumulative session Prompt Cache hit %, and model badge.
- **Breakdown & Top Bloaters:** Proportional category bar + ranked list of heaviest recent steps/tool outputs.
- **Subagents & 7-Day History Tabs:** Clean tab switching without clutter.
- **Settings Drawer/Tab:** Toggle Option 2 hook warnings, adjust warning thresholds (`70%` / `85%`), configure model limit overrides, switch language (`EN` / `TR`), and view Option 3B (MCP App) opt-in instructions.

### Option 2 — Automatic Threshold Warnings via `PostInvocation` Hook (Toggleable · 0 Model Tokens)
Registered in `hooks.json` under `PostInvocation`:
- Reads stdin payload (`conversationId`, `transcriptPath`, `modelName`, `invocationNum`).
- Checks current `input_tokens / limit` against configured thresholds (default: warning `70%`, critical `85%`).
- Uses `${PLUGIN_DATA}/hook-state.json` to ensure each threshold fires **at most once per session** (or resets if compaction reduces tokens below threshold).
- Injects a user-only markdown notice via `injectSteps`:
  ```json
  {
    "injectSteps": [
      {
        "systemMessage": {
          "systemMessage": "",
          "metadata": {
            "user_markdown": "..."
          }
        }
      }
    ]
  }
  ```
  Leaving `systemMessage` as `""` ensures **zero tokens are injected into the model context**.
- Can be toggled on/off in plugin settings (`${PLUGIN_DATA}/config.json`).

### Option 3 — Interactive Context Manager (2 Layers)

#### Layer 3A — Zero-Token Sidecar Bridge Actions (Default: ON · 0 Background Tokens)
Uses Antigravity's injected `window.sidecar.agent.sendMessage(prompt)` and clipboard APIs directly from the Sidecar UI:
- **Smart Handoff:** Sends a focused instruction asking the active agent to produce a compact `<HANDOFF_PROMPT>` for a fresh session.
- **Summarize / Compact Checkpoint:** Triggers a structured summary of current state/decisions.
- **Copy Markdown Report:** Copies the current context snapshot + top bloaters to clipboard with zero agent interaction.

#### Layer 3B — Opt-In MCP App / Tool Module (Default: OFF)
For users who explicitly want the model itself to inspect context health or render an inline `ui://` card in chat:
- Disabled by default to preserve 0-token overhead.
- Settings UI shows exact estimated tool-schema token cost and instructions/toggle to enable `mcp_config.json` (`get_context_health` tool + `ui://agy-context-studio/card.html` resource).

---

## 5. Sidecar HTTP & SSE API Contract
- `GET /api/health` — Server status, plugin version, Antigravity data dir status.
- `GET /api/state?conversationId=<id>` — Current `ContextSnapshot` (active session, model, exact tokens, cache %, proportional categories, top bloaters, subagents).
- `GET /api/events?conversationId=<id>` — `text/event-stream` pushing updated `ContextSnapshot` payloads on transcript changes.
- `GET /api/history?days=7` — Aggregated 7-day token & cache efficiency summary.
- `GET /api/settings` & `PUT /api/settings` — Read/update `${PLUGIN_DATA}/config.json` (hook enabled, thresholds, model overrides, language `en` | `tr`).

---

## 6. Internationalization (i18n)
- Default UI & documentation language: **English (`en`)**.
- Built-in **EN / TR** toggle in the Sidecar UI header/settings, persisted in `${PLUGIN_DATA}/config.json` (and reflected in `PostInvocation` hook messages).

---

## 7. Phase 2 Extension Point (`avenoxai/avenoxbeyin`)
After v1 is released as a standalone open-source Antigravity plugin, Phase 2 will add optional integration with `avenoxai/avenoxbeyin` (complementing AvenoxBeyin's context-fill tracking and handoff workflows):
- Expose a structured `ContextSnapshot` export / local webhook or companion bridge so AvenoxBeyin hooks/commands can query exact Antigravity context fill, trigger AvenoxBeyin handoff/compaction flows (`Last-Session.md` / `Threads.md` / `companion-compact`), and surface vault-aware context health inside the Sidecar UI.
