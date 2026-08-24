# Agent Guide — portmap

## What this is

A **deterministic CLI + MCP server** that maps **local dev topology** for AI agents:
declared ports (configs), runtime listeners (OS), and env URL references.

It does **not** start/stop processes, kill ports, or call an LLM. It reads the
filesystem and OS socket table, then emits **`.portmap.json`** and actionable
findings (`PRT-01` … `PRT-07`).

Repo: https://github.com/paladini/portmap

## Layout

- `src/cli.ts` — CLI entry (`portmap` bin → `dist/cli.js`)
- `src/discover/static.ts` — declared ports from configs
- `src/discover/runtime.ts` — OS listeners (Windows + Unix)
- `src/discover/reconcile.ts` — merge static + runtime + findings
- `src/discover/workspace.ts` — multi-repo workspace scan
- `src/parsers/` — env, vite, package.json, docker-compose
- `src/mcp/server.ts` — read-only MCP (4 tools)
- `src/format/output.ts` — text, JSON, Markdown formatters
- `fixtures/` — mismatch, full-stack, frontend-only, workspace
- `docs/FINDINGS.md` — full rule catalog
- `docs/SCHEMA.md` — `.portmap.json` spec

## Build & test

```bash
npm ci
npm run build
npm test
npm run demo:mismatch   # expect PRT-01, PRT-04 findings
npm run demo:full-stack # multiple declared services
npm run demo:workspace  # cross-project env resolution
```

**All tests must pass before commit.**

## Non-negotiable conventions

- **Deterministic only** — no LLM, no network calls in the scan path.
- **Finding IDs are public API** — never renumber (`PRT-01`, …).
- **Prefer false negatives** over noisy false positives.
- **Read-only v1** — no start/stop/kill (Switchboard/PortPilot own lifecycle).
- When adding a rule: update `docs/FINDINGS.md`, README, skills, and tests.

## When agents need port context

1. Run `portmap scan .` (or `portmap declare .` if nothing is running).
2. Read `references[]` for correct localhost URLs — never guess `:3000`.
3. Fix findings: **PRT-04** (broken env URL) before debugging API connectivity.
4. Use MCP tools `portmap_graph` / `portmap_resolve_url` when configured.
5. **Never** re-implement topology discovery with an LLM — trust CLI output.

## Pairing with harness-score and unhappypath

- [harness-score](https://github.com/paladini/harness-score) — is the repo ready for agents?
- **portmap** — do declared ports, listeners, and env URLs align locally?
- [unhappypath](https://github.com/paladini/unhappypath) — is the UI ready for humans?

Pipeline: harness-score → portmap → unhappypath.
