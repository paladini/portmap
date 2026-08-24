# Roadmap

What is planned for portmap after v0.1.0. No dates — shipped when ready.

## Near term

- [ ] **npm publish** — `npx portmap scan .` without cloning
- [ ] **GitHub Action** — `portmap scan --min-findings 0` on every PR
- [ ] **Parser: Next.js** — read `-p` from `next dev` in turbo/monorepo setups
- [ ] **Parser: `.env` variants** — `.env.test`, framework-specific port keys

## Agent ecosystem

- [ ] **`portmap watch`** — file watcher regenerates `.portmap.json` on config change
- [ ] **harness-score integration** — flag when AGENTS.md documents ports that disagree with `.portmap.json`
- [ ] **Published MCP via npx** — zero-path MCP config for Cursor / Claude Code

## Explicitly not planned (v1 scope)

- Start/stop/kill processes — [Switchboard](https://github.com/nnnunezr/switchboard) and PortPilot own lifecycle
- Desktop UI — portmap stays CLI + JSON + MCP
- LLM-based port inference — deterministic only, forever

## How to influence the roadmap

- [Feature request](https://github.com/paladini/portmap/issues/new?template=feature_request.yml)
- [Discussion: Ideas](https://github.com/paladini/portmap/discussions/categories/ideas)
- PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md)
