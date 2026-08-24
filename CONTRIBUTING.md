# Contributing to portmap

Thanks for helping improve local dev topology for agents!

## Setup

```bash
git clone https://github.com/paladini/portmap.git
cd portmap
npm ci
npm run build
npm test
```

## Adding a finding rule

1. Add the ID to `src/types.ts` (`FindingId`, `FINDING_META`)
2. Implement detection in `src/discover/reconcile.ts` or parsers
3. Document in `docs/FINDINGS.md` and README table
4. Add/update fixture + test in `src/tests/`
5. Update `.cursor/skills/portmap/SKILL.md`

**Never renumber existing finding IDs** — they are public API.

## Philosophy

- Deterministic only — no LLM in scan path
- Prefer false negatives over false positives
- Read-only v1 — no start/stop/kill
- Windows + Unix support for runtime scan

## Pull requests

- All tests must pass (`npm test`)
- Keep changes focused
- Update docs when behavior changes
