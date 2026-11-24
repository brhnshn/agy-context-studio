# AGENTS.md — agy-context-studio

Authoritative engineering guide for AI agents and contributors working in `agy-context-studio`.

## 1. Project Overview
`agy-context-studio` is an open-source, zero-token-overhead Context Window Monitor & Manager plugin for Google Antigravity (Desktop 2.0, IDE, and CLI).
- **Primary spec:** See [`SPEC.md`](SPEC.md) for architecture, data contracts, and the 3 modular options.
- **Milestones:** See [`ROADMAP.md`](ROADMAP.md) for current phase and task status.

## 2. Tech Stack & Build Targets
- **Language:** TypeScript (strict mode).
- **Runtime target:** Node.js >= 22 ESM.
- **Backend / Hook / Opt-in MCP:** Compiled to zero-runtime-dependency Node ESM bundles (`sidecars/agy-context-studio/server.mjs`, `hooks/post-invocation.mjs`, `mcp/server.mjs`) so `agy plugin install` works with zero external `node_modules` installation.
- **Sidecar Web UI:** React + TypeScript + Vite static bundle (`sidecars/agy-context-studio/public/`).
- **Testing:** Node built-in test runner (`node --test`) or Vitest for unit/integration tests of parsers, incremental offsets, model limits, and hook dedupe.

## 3. Modular Clean Architecture (Mandatory)
- **No monolithic files.** Split logic cleanly by responsibility:
  - `src/core/` — Transcript parser, incremental byte-offset reader, model-limit registry, proportional breakdown & top-bloater estimator, subagent tree merger, 7-day history aggregator, config/state store.
  - `src/sidecar/` — HTTP + SSE server, route handlers, `fs.watch` manager.
  - `src/hooks/` — `PostInvocation` threshold check & `user_markdown` card emitter.
  - `src/mcp/` — Optional opt-in MCP App/Tool server (`get_context_health` + `ui://` card).
  - `src/ui/services/` — API & SSE client, `window.sidecar` bridge wrapper (no raw `fetch()` inside React components).
  - `src/ui/components/` — Focused UI components, modals, and tabs in separate files.
  - `src/ui/i18n/` — Localization dictionaries (`en` default, `tr`) and hooks.
  - `src/ui/utils/` — Formatting, null-safe token/percentage helpers, SVG icon components.
- **Null-safety:** Guard external/transcript numeric data before calling `.toFixed()`, `.map()`, or dividing.

## 4. UI & Data Discipline
- **Antigravity Theme Integration:** Bind to Antigravity host CSS custom properties with safe light/dark fallbacks.
- **Visual Style:** Minimalist, calm, low-noise interface with purposeful micro-interactions. No `animate-pulse`, `animate-ping`, or flashy decorative effects.
- **Icons & Text:** Use crisp inline SVG icons only — never raw Unicode emojis in UI chrome, and never render fake/non-functional buttons or placeholder shortcuts.
- **Real Data Only:** Never fabricate metrics. When telemetry is missing or loading, render `-` or an explicit empty/loading state. Label proportional estimates clearly as estimates (`~`).

## 5. Local Plugin Testing
- Never edit `~/.gemini/config/config.json` directly or call restricted mutation RPCs.
- Use a dedicated script (`scripts/link-plugin.mjs`) to link or copy the built plugin directory into `~/.gemini/config/plugins/agy-context-studio` for live Antigravity testing.

## 6. Git & Release Discipline
- Use `fix:`, `perf:`, `refactor:`, `docs:`, `chore:` commit prefixes (avoid `feat:` unless explicitly requested).
- Do not add AI attribution trailers (`Co-Authored-By`, etc.) to commits or PRs.
- Do not push to remotes without explicit user approval.
- Keep `CHANGELOG.md` updated for release milestones.

## 7. Phase 2 Note (AvenoxBeyin Integration)
- Keep `src/core/` telemetry schemas (`ContextSnapshot`, `UsageSummary`, threshold state) clean, typed, and exported so Phase 2 can cleanly integrate with `avenoxai/avenoxbeyin` without breaking standalone plugin users.
