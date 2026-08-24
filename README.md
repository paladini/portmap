# portmap

**Your agent hardcoded `localhost:3000`. This maps what actually runs.**

Deterministic CLI + MCP server that maps **local dev topology** for AI agents:
declared ports (configs), runtime listeners (OS), and env URL references — fused into **`.portmap.json`**.

No LLM. No network. No start/stop/kill.

```bash
npx portmap scan .
```

Pair with [harness-score](https://github.com/paladini/harness-score) (repo harness for agents) and [unhappypath](https://github.com/paladini/unhappypath) (UI unhappy-path coverage).

---

## What it is

| | |
|---|---|
| **Scans** | `package.json` scripts, Vite/Next ports, `.env` localhost URLs, `docker-compose` mappings, OS listeners |
| **Emits** | Service graph, env references, edges, findings (`PRT-01`…`PRT-07`) |
| **For agents** | `.portmap.json`, MCP tools, Cursor/Claude skills |

## What it isn't

- **Not a process manager** — use [Switchboard](https://github.com/nnnunezr/switchboard) or PortPilot for start/stop/kill
- **Not a manual registry** — unlike mcp_portman, portmap **discovers** from configs + OS
- **Not production monitoring** — local dev only
- **Not an LLM** — 100% deterministic static analysis + socket table read

---

## Why agents need this

```
Agent: fetch('http://localhost:3000/api/users')
Reality: Vite on :5173, API on :8080, nothing on :3000
```

Agents assume `:3000` because Next.js defaults there. Vite uses `:5173`. Docker remaps ports. `.env.example` lies. **portmap** tells the agent what's declared, what's listening, and what's broken — before wasting a debug loop.

---

## Install

```bash
git clone https://github.com/paladini/portmap.git
cd portmap
npm ci && npm run build
node dist/cli.js scan /path/to/project
```

Or after npm publish:

```bash
npx portmap scan .
```

---

## Usage

### Full scan (static + OS listeners)

```bash
portmap scan .
portmap scan . --json
portmap scan . --write          # writes .portmap.json
portmap scan . --markdown --out report.md
```

### Static only (no running processes needed)

```bash
portmap declare .
```

### Multi-repo workspace

```bash
portmap workspace ~/code/my-workspace
```

Resolves cross-project env refs (e.g. frontend in `web/` calling API in `api/`).

### List OS listeners

```bash
portmap listen
portmap listen --json
```

### CI gate

```bash
portmap scan . --min-findings 1 --min-severity error
# exit 1 if any error-level findings
```

---

## Example output

```
portmap — mismatch-app
root: D:/code/portmap/fixtures/mismatch

Services:
  [down] vite — Vite dev server
    declared :5173 (vite.config.ts:server.port)
    not listening
  …

Env references:
  NEXT_PUBLIC_API_URL=http://localhost:3000 → :3000 [unresolved] (.env.local:1)
  VITE_API_URL=http://localhost:8080 → :8080 [unresolved] (.env.local:2)

Findings: 3 error(s), 0 warning(s)
  ✖ PRT-01 Declared port 5173 is not listening …
  ✖ PRT-04 VITE_API_URL points to localhost:8080 but nothing is listening …
```

---

## Findings

| ID | Rule | Severity |
|----|------|----------|
| PRT-01 | Declared port not listening | error |
| PRT-02 | Listener without declared config | warning |
| PRT-03 | Two services declare same port | error |
| PRT-04 | Env URL points to port with no listener | error |
| PRT-05 | Listener on different port than declared | warning |
| PRT-06 | Docker host:container port mismatch | warning |
| PRT-07 | Cross-workspace env ref unresolved | error |

Full catalog: [docs/FINDINGS.md](docs/FINDINGS.md)

---

## MCP setup (read-only)

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

### Tools

| Tool | Description |
|------|-------------|
| `portmap_scan` | Full `.portmap.json` report |
| `portmap_graph` | Slim `{ services, edges, references }` |
| `portmap_resolve_url` | Resolve env key → URL + status |
| `portmap_findings` | List PRT-* findings |

---

## `.portmap.json`

Committed artifact agents read for stable topology. Spec: [docs/SCHEMA.md](docs/SCHEMA.md)

```bash
portmap scan . --write
git add .portmap.json
```

---

## Agent pipeline

```
harness-score  →  Is the repo ready for agents?
portmap        →  Do ports and env URLs align locally?
unhappypath    →  Is the UI ready for humans?
```

---

## Limitations (honest)

- **PID → repo attribution** is heuristic; may miss or mis-attribute on Windows
- **WSL/Docker networking** — listeners inside containers may not appear as expected
- **Runtime-only ports** (hardcoded in JS, no config) are not declared — PRT-02 may warn
- **YAML compose** — v1 parses common `ports:` patterns; exotic compose features skipped
- Prefer **false negatives** over noisy false positives

---

## Development

```bash
npm ci
npm run build
npm test
npm run demo:mismatch
npm run demo:workspace
```

See [AGENTS.md](AGENTS.md) for contributor/agent guide.

---

## License

MIT © [Fernando Paladini](https://github.com/paladini)
