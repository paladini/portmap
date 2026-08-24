# `.portmap.json` schema (portmap-v1)

Machine-readable local topology for humans and AI agents.

## Top-level fields

| Field | Type | Description |
|-------|------|-------------|
| `schema` | `"portmap-v1"` | Schema version (public API) |
| `generatedAt` | ISO 8601 string | Scan timestamp |
| `project` | object | `{ name, root }` |
| `services` | array | Declared + actual service entries |
| `references` | array | Env vars pointing at localhost |
| `edges` | array | Frontend → backend relationships |
| `listeners` | array | OS listeners seen during scan |
| `findings` | array | Actionable issues (PRT-*) |

## Service object

```json
{
  "id": "vite",
  "label": "Vite dev server",
  "role": "frontend",
  "declared": {
    "port": 5173,
    "host": "localhost",
    "sources": ["vite.config.ts:server.port"]
  },
  "actual": {
    "listening": true,
    "port": 5173,
    "pid": 12345,
    "process": "node",
    "command": "vite --host",
    "url": "http://localhost:5173",
    "attribution": "high"
  },
  "status": "ok"
}
```

**Status values:** `ok` | `down` | `mismatch` | `conflict` | `orphan`

**Role values:** `frontend` | `api` | `database` | `worker` | `other`

## Reference object

```json
{
  "envKey": "VITE_API_URL",
  "value": "http://localhost:8080",
  "targetPort": 8080,
  "host": "localhost",
  "sourceFile": ".env.local:1",
  "resolvedService": "compose-api",
  "status": "resolved"
}
```

**Status values:** `resolved` | `unresolved` | `mismatch`

## Edge object

```json
{
  "from": "vite",
  "to": "compose-api",
  "via": "VITE_API_URL",
  "port": 8080
}
```

## Finding object

```json
{
  "id": "PRT-04",
  "severity": "error",
  "message": "VITE_API_URL points to localhost:8080 but nothing is listening",
  "fix": "Start the API service or update .env.local",
  "file": ".env.local:1",
  "serviceId": "vite"
}
```

## Workspace report

`portmap workspace` returns:

```json
{
  "schema": "portmap-v1",
  "workspaceRoot": "/path/to/workspace",
  "projects": [ /* PortMapReport[] */ ],
  "findings": [ /* merged + PRT-07 */ ]
}
```

## Agent usage

1. Prefer reading committed `.portmap.json` if fresh (< 1 day).
2. Otherwise call `portmap scan . --write` or MCP `portmap_scan`.
3. Use `references[].value` for fetch/curl URLs — never assume `:3000`.
4. Fix all `severity: "error"` findings before debugging connectivity.
