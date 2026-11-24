# Changelog

All notable changes to `agy-context-studio` are documented in this file.

## [0.1.1] - 2026-11-25

### Fixed
- **Native Antigravity Sidecar Startup (`server.ts`, `post-invocation.ts`, `mcp/server.ts`):** Resolved Windows junction entrypoint path resolution using `fs.realpathSync` so direct-execution checks succeed when Antigravity launches the linked plugin, and wired Antigravity sidecar environment variables (`ANTIGRAVITY_SIDECAR_WEB_PORT`, `ANTIGRAVITY_CONVERSATION_ID`, `ANTIGRAVITY_SIDECAR_UI_TOKEN`, `ANTIGRAVITY_AGENTAPI_EXE`).
- **Sidecar Host Bridge & Routes (`src/sidecar/routes.ts`):** Added `/preload.js`, `POST /_sidecar/send-message`, `POST /_sidecar/get-conversation-metadata`, and loopback CORS/`OPTIONS` preflight headers.
- **Aux Pane Blank Black Screen (`vite.config.ts`, `src/ui/`):** Compiled the sidecar UI as a classic non-module IIFE bundle (`assets/app.js`, `assets/app.css`) without `crossorigin`, moved `/preload.js` into `<head>`, switched requests and SSE (`?token=` preserved) to root-relative `/api/*` paths, and added a loading fallback plus React `ErrorBoundary`.

## [0.1.0] - 2026-11-25

### Added
- **Project Scaffold & Bundling (M0):** Strict TypeScript setup, Vite + React UI build, zero-dependency Node >= 22 ESM bundles (`esbuild`), Antigravity `plugin.json` / `sidecar.json` / `logo.svg`, and `scripts/link-plugin.mjs` local linker.
- **Core Telemetry Engine (`src/core/`, M1):** Incremental byte-offset `transcript.jsonl` reader, exact `input_tokens + cache_read_tokens` and prompt cache hit math, built-in model context limit catalog (`gemini-4*`, `gemini-3*`, `claude-*`, etc.) + `config.json` overrides, proportional category breakdown (`~estimate`), deduplicated tool call summaries with target filenames, subagent tree aggregator, and 7-day local usage history aggregator.
- **Sidecar HTTP + SSE Server (`src/sidecar/`, M2):** Zero-dependency HTTP/SSE server (`/api/health`, `/api/conversations`, `/api/models`, `/api/state`, `/api/events`, `/api/history`, `/api/settings`) with debounced `fs.watch` updates, `no-store` HTML cache headers, and static UI serving.
- **Sidecar Web UI (`src/ui/`, M3):** Antigravity theme-integrated React dashboard with top Quick Actions toolbar, reusable `CustomSelect` and `NumberStepper` controls, container-query responsive `2×3`/`3×2` KPI grid, dual-segment cached/uncached fill bar, interactive category filter pills, Subagents, 7-Day History chart, Settings with real detected Antigravity models, and full `EN` / `TR` localization.
- **`PostInvocation` Threshold Warning Hook (`src/hooks/`, M4):** Toggleable zero-model-token threshold alerts (`systemMessage: ""`, `metadata.user_markdown`) with per-session deduplication and compaction reset in `hook-state.json`.
- **Interactive Context Manager (`src/ui/` + `src/mcp/`, M5):**
  - Layer 3A: One-click **Smart Handoff**, **Compact Checkpoint**, and **Copy Markdown Report** via `window.sidecar.agent.sendMessage()` with clipboard fallback.
  - Layer 3B: Opt-in stdio MCP App server (`get_context_health` tool + inline `ui://agy-context-studio/card.html` card, disabled by default).
- **Release & Showcase (`docs/`, `.github/`, M6):** Bilingual `README.md` + `README.tr.md`, `CONTRIBUTING.md`, GitHub CI & Pages workflows, issue/PR templates, live UI screenshots, and static showcase site in `docs/`.
