# agy-context-studio

> Zero-token-overhead Context Window Monitor & Manager plugin for Google Antigravity (Desktop 2.0, IDE, and CLI).

`agy-context-studio` gives you real-time visibility and practical control over your active LLM context window without spending model tokens to monitor itself.

## Architecture

```text
transcript.jsonl (disk)
   ├──▶ src/core/ (Incremental byte-offset reader, model limits, ~breakdown, bloaters, subagents, 7-day history)
   │       ├──▶ Sidecar HTTP + SSE Server (Option 1: Live Aux-Pane Web UI + Layer 3A Handoff Actions · 0 tokens)
   │       ├──▶ PostInvocation Hook (Option 2: User-only threshold cards via metadata.user_markdown · 0 tokens)
   │       └──▶ Opt-In MCP App Server (Option 3B: get_context_health + ui:// inline card · default OFF)
```

## Features (3 Modular Options)

1. **Live Sidecar Web UI Monitor (Default: ON · 0 Tokens)**
   - Exact `totalInputTokens / limit` fill meter with auto-compaction threshold marker.
   - Turn-level and session-wide **Prompt Cache** efficiency tracking (`cache_read_tokens / (input_tokens + cache_read_tokens)`).
   - Proportional category breakdown (explicitly labeled as `~estimate`) + **Top Context Bloaters** list.
   - Subagent token summary and 7-day local usage/cache-savings history.
   - Synced with Antigravity's light/dark theme and includes an **EN / TR** language switcher.

2. **Automatic Threshold Warnings via `PostInvocation` Hook (Toggleable · 0 Model Tokens)**
   - Evaluates context fill after each model turn (`70%` warning / `85%` critical by default, configurable in Settings).
   - Emits a clean user-only markdown card (`metadata.user_markdown` with empty `systemMessage`) once per threshold per session and resets automatically after compaction.

3. **Interactive Context Manager (Sidecar Actions + Opt-In MCP App)**
   - **Layer 3A — Sidecar Bridge (Default: ON · 0 Background Tokens):** One-click **Smart Handoff**, **Compact Checkpoint**, and **Copy Markdown Report** using `window.sidecar.agent.sendMessage()` (with clipboard fallback).
   - **Layer 3B — Opt-In MCP App (Default: OFF):** Optional `get_context_health` tool + inline `ui://agy-context-studio/card.html` card (~350 schema tokens/turn only if manually enabled via [mcp/mcp_config.template.json](mcp/mcp_config.template.json)).

## Development & Local Testing

```bash
npm install
npm run build        # Typecheck + zero-dep ESM bundles + Vite React UI
npm test             # Node built-in test runner (core, sidecar, hook, MCP)
npm run link:plugin  # Link/copy built plugin into ~/.gemini/config/plugins/agy-context-studio
```

For full technical specifications and milestones, see [`SPEC.md`](SPEC.md), [`AGENTS.md`](AGENTS.md), [`ROADMAP.md`](ROADMAP.md), and [`CHANGELOG.md`](CHANGELOG.md).

## License

[MIT](LICENSE)
