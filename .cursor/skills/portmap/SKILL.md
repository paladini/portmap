---
name: portmap
description: Map local dev topology before hardcoding localhost URLs or debugging API connectivity. Use when starting dev servers, configuring env vars, or when the agent assumes port 3000.
---

# portmap

Deterministic local service topology for AI agents. **Run the CLI — do not guess ports.**

## When to use

- Before writing `fetch('http://localhost:…')` or curl commands
- When `.env` has `*_URL` pointing at localhost
- When multiple services (frontend + API) exist in one repo or workspace
- After an agent session that may have hardcoded wrong ports

## Workflow

1. **Scan the project:**
   ```bash
   npx portmap scan .
   ```
   Or static-only (no OS listeners):
   ```bash
   npx portmap declare .
   ```

2. **Read the output:**
   - `services[]` — declared vs actual ports
   - `references[]` — env keys → localhost URLs
   - `edges[]` — how frontend connects to backend
   - `findings[]` — fix these before debugging

3. **Fix in order:**
   - **PRT-04** — env URL points to port with no listener
   - **PRT-01** — declared service not running
   - **PRT-03** — port collision in config
   - **PRT-05** — listener on unexpected port (Vite port bump)

4. **Write artifact for future sessions:**
   ```bash
   portmap scan . --write
   ```
   Commits `.portmap.json` so agents read stable topology.

## MCP tools (if configured)

| Tool | Use when |
|------|----------|
| `portmap_scan` | Full report JSON |
| `portmap_graph` | Slim services + edges + references |
| `portmap_resolve_url` | "What is the correct URL for VITE_API_URL?" |
| `portmap_findings` | List actionable PRT-* issues |

## Multi-repo workspace

```bash
portmap workspace ~/code/my-monorepo
```

Resolves cross-project env refs (PRT-07) when API lives in a sibling folder.

## Rules

- **Never** assume port 3000 — read `references[]`
- **Never** re-implement port discovery with an LLM
- portmap is **read-only** — it does not start/stop/kill processes
- Pair with [harness-score](https://github.com/paladini/harness-score) and [unhappypath](https://github.com/paladini/unhappypath)
