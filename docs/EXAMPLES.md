# Before & after examples

Concrete fixes from the repo fixtures. Run the demos yourself:

```bash
npm run demo:mismatch
npm run demo:workspace
npm run demo:full-stack
```

---

## Agent guesses `:3000` — reality is `:5173` + `:8080`

**Fixture:** `fixtures/mismatch`

### Before (what the agent does)

```typescript
// Agent hardcodes Next.js default — wrong stack
const res = await fetch("http://localhost:3000/api/users");
```

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000   # nothing listens here
VITE_API_URL=http://localhost:8080          # API port — but API not started
```

```typescript
// vite.config.ts — app actually runs here
export default defineConfig({
  server: { port: 5173, strictPort: true },
});
```

**portmap findings:** PRT-01 (Vite not running), PRT-04 ×2 (both env URLs broken)

### After (what portmap tells you to do)

1. Start Vite: `npm run dev` → listens on `:5173`
2. Start API on `:8080` (or update `VITE_API_URL` to match reality)
3. Use env values from `references[]`, never assume `:3000`:

```typescript
const apiUrl = import.meta.env.VITE_API_URL; // http://localhost:8080
const res = await fetch(`${apiUrl}/api/users`);
```

Or commit topology for agents:

```bash
portmap scan . --write
# agents read .portmap.json → references[].value
```

---

## Dev server not running

**Fixture:** `fixtures/mismatch` · **Finding:** PRT-01

### Before

```
Services:
  [down] vite — Vite dev server
    declared :5173 (vite.config.ts:server.port)
    not listening
```

### After

```bash
npm run dev
portmap scan .   # status: ok, actual.listening: true
```

---

## Frontend + API in sibling folders

**Fixture:** `fixtures/workspace`

```
workspace/
  api/     → PORT=8080, script dev -p 8080
  web/     → Vite :5173, VITE_API_URL=http://localhost:8080
```

### Before (single-repo scan misses cross-ref)

```bash
portmap scan web/
# VITE_API_URL → :8080 [unresolved] — API lives in ../api
```

### After (workspace scan resolves)

```bash
portmap workspace fixtures/workspace
```

```
── workspace-web
   vite: declared :5173 → down
── workspace-api
   dev: declared :8080 → down

# web's VITE_API_URL resolves to api's declared :8080
# PRT-07: not emitted — cross-workspace ref matched
```

---

## Sample `.portmap.json` (declared-only)

From `portmap declare fixtures/mismatch`:

```json
{
  "schema": "portmap-v1",
  "project": { "name": "mismatch-app", "root": "…/fixtures/mismatch" },
  "services": [
    {
      "id": "vite",
      "label": "Vite dev server",
      "role": "frontend",
      "declared": { "port": 5173, "host": "localhost", "sources": ["vite.config.ts:server.port"] },
      "actual": null,
      "status": "down"
    }
  ],
  "references": [
    {
      "envKey": "VITE_API_URL",
      "value": "http://localhost:8080",
      "targetPort": 8080,
      "sourceFile": ".env.local:2",
      "status": "unresolved"
    }
  ],
  "findings": [
    {
      "id": "PRT-04",
      "severity": "error",
      "message": "VITE_API_URL points to localhost:8080 but nothing is listening",
      "fix": "Start the service on port 8080 or update .env.local:2"
    }
  ]
}
```

Full schema: [SCHEMA.md](SCHEMA.md)
