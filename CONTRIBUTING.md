# Contributing to portmap

Thanks for helping improve local dev topology for agents. Every parser, false-positive fix, and doc improvement makes AI-assisted development less painful.

## Get started

```bash
git clone https://github.com/paladini/portmap.git
cd portmap
npm ci
npm run build
npm test
```

## Ways to help

| I want to… | Start here |
| --- | --- |
| Report a crash or wrong output | [Bug report](https://github.com/paladini/portmap/issues/new?template=bug_report.yml) |
| Report a wrong PRT-* finding | [False positive](https://github.com/paladini/portmap/issues/new?template=false_positive.yml) |
| Suggest a parser or new rule | [Feature request](https://github.com/paladini/portmap/issues/new?template=feature_request.yml) |
| Ask a question or share usage | [Discussions](https://github.com/paladini/portmap/discussions) |
| Fix code or docs | Open a PR (template auto-applies) |

Security vulnerabilities: see [SECURITY.md](SECURITY.md) — **do not** file a public issue.

## Adding a finding rule

1. Add the ID to `src/types.ts` (`FindingId`, `FINDING_META`)
2. Implement detection in `src/discover/reconcile.ts` or parsers
3. Document in [docs/FINDINGS.md](docs/FINDINGS.md) and README findings table
4. Add before/after in [docs/EXAMPLES.md](docs/EXAMPLES.md) if helpful
5. Add/update fixture + test in `src/tests/`
6. Update [.cursor/skills/portmap/SKILL.md](.cursor/skills/portmap/SKILL.md)

**Never renumber existing finding IDs** — they are public API.

## Adding a parser

1. Add parser under `src/parsers/`
2. Wire into `src/discover/static.ts`
3. Fixture with real config snippet + unit test
4. Document supported patterns and known limits in FINDINGS.md or README

Prefer **false negatives** — if detection is uncertain, skip rather than noise.

## Philosophy

- Deterministic only — no LLM in scan path
- Read-only v1 — no start/stop/kill (Switchboard/PortPilot own lifecycle)
- Windows + Unix support for runtime scan
- Finding IDs and `.portmap.json` schema are versioned public API

## Pull requests

- All tests must pass (`npm test`)
- Keep changes focused — one parser or one rule per PR when possible
- Update docs when behavior changes
- Follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned work. Feature requests that align with the roadmap are more likely to merge quickly.

## Agent contributors

If you are an AI agent patching findings: read [AGENTS.md](AGENTS.md) and run `portmap scan .` — do not re-implement topology discovery yourself.
