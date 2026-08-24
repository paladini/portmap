# PortMap findings catalog

Finding IDs are **public API** — never renumber.

## PRT-01 — Declared port not listening

**Severity:** error

A service port is declared in config (`vite.config`, `package.json` scripts, `docker-compose`) but nothing is listening on that port at scan time.

**Fix:** Start the dev server or update the declared port to match reality.

---

## PRT-02 — Orphan listener

**Severity:** warning

A process listens on a port attributed to this project, but no config declares that port.

**Fix:** Add the port to project config if it belongs here; otherwise ignore (may be another tool).

---

## PRT-03 — Port collision

**Severity:** error

Two or more services in the same project declare the same port.

**Fix:** Assign distinct ports in scripts, vite config, or compose file.

---

## PRT-04 — Broken env URL reference

**Severity:** error

An env variable (`*_URL`, `API_URL`, etc.) points to `localhost:PORT` but nothing is listening on that port.

**Fix:** Start the target service or update the env file.

---

## PRT-05 — Declared vs actual port mismatch

**Severity:** warning

Something is listening, but on a different port than declared (common when Vite bumps port because `strictPort: false`).

**Fix:** Set `strictPort: true` or update config/env to the actual port.

---

## PRT-06 — Docker compose port mapping mismatch

**Severity:** warning

Docker maps `host:container` where host port ≠ container port. The app inside the container must listen on the **container** port.

**Fix:** Verify the app binds to the container-side port; update compose or app config.

---

## PRT-07 — Cross-workspace unresolved reference

**Severity:** error

In a workspace scan, an env URL references a localhost port that no sibling project declares or listens on.

**Fix:** Start the API in the sibling repo or fix the env URL across projects.
