# Contributing to `agy-context-studio`

Thank you for your interest in contributing to `agy-context-studio`!

## Prerequisites
- **Node.js >= 22** (ESM native test runner `node --test` and TypeScript via `tsx`)
- **npm >= 10**

## Development Setup

```bash
git clone https://github.com/brhnshn/agy-context-studio.git
cd agy-context-studio
npm install
npm run build
npm test
```

## Architecture & Engineering Rules
Please follow the conventions in [`AGENTS.md`](AGENTS.md):
- **Modular separation:** Keep core telemetry in `src/core/`, HTTP/SSE in `src/sidecar/`, React UI in `src/ui/` (API calls strictly inside `src/ui/services/`), hooks in `src/hooks/`, and opt-in MCP in `src/mcp/`.
- **Zero-token core:** Monitoring, hooks, and background sidecar updates must never inject extra tokens into the LLM context.
- **Zero-runtime-dependency bundles:** Backend, hook, and MCP `.mjs` bundles must remain self-contained so `agy plugin install` requires no `npm install`.
- **Real telemetry only:** Never fabricate metrics or default to fake placeholders; render `-` when unavailable and mark proportional breakdowns as estimates (`~`).

## Commit Style
Use conventional prefixes such as `fix:`, `perf:`, `refactor:`, `docs:`, or `chore:`. Run `npm run build && npm test` before opening a pull request.
