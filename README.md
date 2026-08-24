<div align="center">

# portmap

**Your agent hardcoded `localhost:3000`. This maps what actually runs.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/paladini/portmap/actions/workflows/ci.yml/badge.svg)](https://github.com/paladini/portmap/actions/workflows/ci.yml)

```bash
git clone https://github.com/paladini/portmap.git && cd portmap
npm ci && npm run build && node dist/cli.js scan /path/to/your-app
```

Deterministic · No LLM · No network · Read-only

</div>

---

## What is this?

**portmap** is a command-line tool + MCP server that answers one question:

> *Before your agent runs `curl localhost:3000`, does anything actually listen there?*

It fuses three layers of local dev reality into a single map:

1. **Declared** — ports in `vite.config`, `package.json` scripts, `.env` URLs, `docker-compose`
2. **Actual** — what your OS says is listening right now (Windows, macOS, Linux)
3. **Connected** — how env vars (`VITE_API_URL`, `API_URL`, …) link services together

Output: **`.portmap.json`** + actionable findings (`PRT-01` … `PRT-07`) that agents and CI can consume without guessing.

### Who is it for?

- Developers tired of **"kill port 3000"** and **"works on my machine"** port drift
- Teams using **AI coding agents** (Cursor, Claude Code, Copilot) that hardcode wrong localhost URLs
- Monorepos where **frontend and API live in sibling folders** and env refs cross repos
- Anyone who wants a **5-second sanity check** before debugging API connectivity

### What it is **not**

| Expectation | Reality |
| --- | --- |
| Starts/stops your dev servers | **No** — use [Switchboard](https://github.com/nnnunezr/switchboard) or PortPilot for lifecycle |
| Manual port registry you maintain | **No** — portmap **discovers** from configs + OS |
| Production monitoring / uptime | **No** — local dev topology only |
| Uses an LLM to infer ports | **No** — 100% deterministic filesystem + socket table |

If you need to kill a process, use your OS tools. portmap tells you **which port to hit** before you waste twenty minutes.

---

## The problem

Every AI-assisted dev session hits this eventually:

```
Agent:  fetch('http://localhost:3000/api/users')
Reality: Vite on :5173, API on :8080, nothing on :3000
```

Why it happens:

- **Next.js** defaults to `:3000` — agents memorize that
- **Vite** defaults to `:5173` — different stack, different port
- **Docker** remaps `8080:3000` — the app listens inside the container, not where you think
- **`.env.local`** points at a port nobody started today
- You debug CORS, auth, and "network error" for twenty minutes when the real bug is **PRT-04**

**portmap** surfaces the mismatch in seconds — declared vs listening vs env — so you fix the URL, not the symptom.

---

## How it works

Two scanners, one reconcile step, zero LLM:

```
┌─────────────────────────────────────────────────────────────┐
│  Your repo on disk                                          │
├─────────────────────────────────────────────────────────────┤
│  1. Static discovery                                        │
│     package.json scripts · vite.config · .env localhost URLs│
│     docker-compose port mappings                            │
├─────────────────────────────────────────────────────────────┤
│  2. Runtime scan (optional)                                 │
│     OS listeners → port, PID, process, command line           │
├─────────────────────────────────────────────────────────────┤
│  3. Reconcile                                               │
│     declared ↔ actual ↔ env references → service graph        │
│     → .portmap.json + findings (PRT-01 … PRT-07)            │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
    CLI pretty          MCP tools            CI --min-findings
```

Full rule list: [docs/FINDINGS.md](docs/FINDINGS.md) · Before/after fixes: [docs/EXAMPLES.md](docs/EXAMPLES.md) · JSON spec: [docs/SCHEMA.md](docs/SCHEMA.md)

---

## Try it in 30 seconds

```bash
git clone https://github.com/paladini/portmap.git
cd portmap
npm ci && npm run build

npm run demo:mismatch     # classic agent mistake → 3 errors
npm run demo:workspace    # frontend + API in sibling folders → resolved
```

### What `demo:mismatch` looks like

```
portmap — mismatch-app
root: …/fixtures/mismatch

Services:
  [down] vite — Vite dev server
    declared :5173 (vite.config.ts:server.port)
    not listening

Env references:
  NEXT_PUBLIC_API_URL=http://localhost:3000 → :3000 [unresolved]
  VITE_API_URL=http://localhost:8080 → :8080 [unresolved]

Findings: 3 error(s), 0 warning(s)
  ✖ PRT-01 Declared port 5173 is not listening …
  ✖ PRT-04 NEXT_PUBLIC_API_URL points to localhost:3000 but nothing is listening …
  ✖ PRT-04 VITE_API_URL points to localhost:8080 but nothing is listening …
```

That's the entire debug session an agent skips when it reads `.portmap.json` first.

---

## Install & run

### Option A — Clone (works today)

```bash
git clone https://github.com/paladini/portmap.git
cd portmap
npm ci && npm run build
node dist/cli.js scan /path/to/your-app
```

### Option B — npm (when published)

```bash
npx portmap scan .
```

### Typical workflow

1. **Run** `portmap scan .` (or `declare .` if nothing is running yet)
2. **Read** `references[]` for correct localhost URLs — never assume `:3000`
3. **Fix** PRT-04 (broken env URL) before debugging API connectivity
4. **Write** `.portmap.json` for future agent sessions: `portmap scan . --write`
5. **Optional:** gate CI with `--min-findings 1 --min-severity error`

---

## Commands

| Command | What it does |
| --- | --- |
| `portmap scan [path]` | Full scan: static configs + OS listeners |
| `portmap declare [path]` | Static only — no running processes needed |
| `portmap listen` | List OS listeners (debug) |
| `portmap workspace [dir]` | Multi-repo: resolve cross-folder env refs |
| `portmap mcp` | Start read-only MCP stdio server |

**Flags:** `--json` · `--markdown` · `--write` (save `.portmap.json`) · `--out <file>` · `--min-findings N` · `--quiet`

---

## Findings at a glance

| ID | Rule | Severity |
| --- | --- | --- |
| PRT-01 | Declared port not listening | error |
| PRT-02 | Listener without declared config | warning |
| PRT-03 | Two services declare same port | error |
| PRT-04 | Env URL points to port with no listener | error |
| PRT-05 | Listener on different port than declared | warning |
| PRT-06 | Docker host:container port mismatch | warning |
| PRT-07 | Cross-workspace env ref unresolved | error |

Full catalog with fixes: [docs/FINDINGS.md](docs/FINDINGS.md)

---

## MCP for agents (read-only)

Add to `.cursor/mcp.json` or Claude Code config:

```json
{
  "mcpServers": {
    "portmap": {
      "command": "node",
      "args": ["/path/to/portmap/dist/cli.js", "mcp"]
    }
  }
}
```

| Tool | Use when |
| --- | --- |
| `portmap_scan` | Full `.portmap.json` report |
| `portmap_graph` | Slim `{ services, edges, references }` |
| `portmap_resolve_url` | "What URL should I use for `VITE_API_URL`?" |
| `portmap_findings` | List PRT-* issues filtered by severity |

Skill for Cursor/Claude: [.cursor/skills/portmap/SKILL.md](.cursor/skills/portmap/SKILL.md)

---

## `.portmap.json` — the artifact agents read

```bash
portmap scan . --write
git add .portmap.json   # optional: commit for stable agent context
```

Spec: [docs/SCHEMA.md](docs/SCHEMA.md)

---

## Agent-readiness pipeline

Part of the **paladini agent toolkit** — three deterministic checks, zero LLM:

```
harness-score  →  Is the repo harness ready for agents?
portmap        →  Do ports and env URLs align locally?
unhappypath    →  Is the UI ready for real users?
```

| Tool | Question |
| --- | --- |
| [harness-score](https://github.com/paladini/harness-score) | AGENTS.md, rules, hooks, CI maturity |
| **portmap** | Declared ports, listeners, env graph |
| [unhappypath](https://github.com/paladini/unhappypath) | Loading, empty, error, retry UI states |

---

## Limitations (honest)

- **PID → repo attribution** is heuristic; low-confidence matches are flagged, not hidden
- **WSL / Docker networking** — listeners inside containers may not appear as expected on the host
- **Runtime-only ports** (hardcoded in JS with no config) won't be declared — PRT-02 may warn
- **YAML compose** — v1 parses common `ports:` patterns; exotic compose features are skipped
- Prefer **false negatives** over noisy false positives — if unsure, portmap stays quiet

---

## Contributing

Issues, false-positive reports, and parser contributions welcome.

| Channel | Link |
| --- | --- |
| Bug report | [Open issue](https://github.com/paladini/portmap/issues/new?template=bug_report.yml) |
| False positive | [Report PRT-* misfire](https://github.com/paladini/portmap/issues/new?template=false_positive.yml) |
| Feature request | [Request parser / rule](https://github.com/paladini/portmap/issues/new?template=feature_request.yml) |
| Questions & ideas | [Discussions](https://github.com/paladini/portmap/discussions) |

See [CONTRIBUTING.md](CONTRIBUTING.md) · [ROADMAP.md](ROADMAP.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

Security issues: [SECURITY.md](SECURITY.md) — please do not file publicly.

---

## Development

```bash
npm ci
npm run build
npm test
npm run demo:mismatch
npm run demo:workspace
```

Agent/contributor guide: [AGENTS.md](AGENTS.md)

---

## License

[MIT](LICENSE) © 2026 [Fernando Paladini](https://github.com/paladini)
