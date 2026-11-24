# ROADMAP.md — agy-context-studio

## Phase 1 — Standalone Open-Source Antigravity Plugin (v1.0)

### M0: Project Scaffold & Tooling
- [x] Initialize standalone repository (`C:\Users\sahin\Desktop\Projeler\agy-context-studio`), `SPEC.md`, `AGENTS.md`, `ROADMAP.md`, `README.md`, `LICENSE`, `.gitignore`
- [x] Set up `package.json`, `tsconfig.json`, Vite + React + TypeScript config, esbuild bundle scripts, and `scripts/link-plugin.mjs`
- [x] Add Antigravity `plugin.json`, `assets/logo.svg`, and `sidecars/agy-context-studio/sidecar.json`

### M1: Core Telemetry & Transcript Engine (`src/core/`)
- [x] Implement `transcript.jsonl` incremental byte-offset parser (exact `input_tokens`, `cache_read_tokens`, `output_tokens`, `model`, `tool_calls`)
- [x] Implement model context-limit catalog + `${PLUGIN_DATA}/config.json` override support
- [x] Implement proportional category weight estimator & Top Bloaters ranker
- [x] Implement subagent session discovery/aggregation and 7-day local history aggregator
- [x] Write unit tests with fixture transcripts (`node --test`)

### M2: Sidecar HTTP + SSE Server (`src/sidecar/`)
- [x] Implement zero-dependency Node HTTP + SSE server serving static UI + `/api/*` endpoints
- [x] Wire `fs.watch` with debounced incremental updates per `conversationId`
- [x] Bundle to `sidecars/agy-context-studio/server.mjs` and verify startup

### M3: Sidecar Web UI (`src/ui/`)
- [x] Build modular services (`apiClient.ts`, `sidecarBridge.ts`), utils, and `en`/`tr` i18n dictionaries
- [x] Build Overview view (context fill meter, compaction marker, prompt cache hits, proportional breakdown, top bloaters)
- [x] Build Subagents, 7-Day History, and Settings views (EN/TR toggle, hook thresholds, model overrides)
- [x] Bind Antigravity host CSS theme variables (`light`/`dark`) and verify clean calm design

### M4: Option 2 — `PostInvocation` Threshold Warning Hook (`src/hooks/`)
- [x] Implement `PostInvocation` handler reading stdin payload and checking thresholds against `${PLUGIN_DATA}/config.json`
- [x] Implement per-session threshold dedupe in `${PLUGIN_DATA}/hook-state.json`
- [x] Emit zero-token `user_markdown` warning cards (`systemMessage: ""`) in EN/TR
- [x] Wire `hooks.json` and bundle to `hooks/post-invocation.mjs` with unit tests

### M5: Option 3 — Interactive Context Manager (`window.sidecar` + Opt-in MCP App)
- [x] Layer 3A: Wire Smart Handoff, Summarize/Compact prompt triggers via `window.sidecar.agent.sendMessage()`, and Copy Markdown report
- [x] Layer 3B: Build opt-in MCP App server (`get_context_health` + `ui://` inline card) with explicit toggle guide in Settings

### M6: Local Verification & Open-Source Release
- [x] Link plugin to `~/.gemini/config/plugins/agy-context-studio` and verify live inside Antigravity (Sidecar UI, Hook alerts, Handoff actions)
- [x] Finalize `README.md`, `CHANGELOG.md`, screenshots/architecture diagram, and prepare GitHub release

---

## Phase 2 — AvenoxBeyin Integration
- [ ] Design & implement optional integration bridge for `avenoxai/avenoxbeyin` (context-fill telemetry sync, vault-aware handoff triggers, and `companion-compact` awareness)
