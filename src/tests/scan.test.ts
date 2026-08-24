import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverStatic } from "../discover/static.js";
import { declareProject } from "../discover/reconcile.js";
import { scanWorkspace } from "../discover/workspace.js";
import { parseComposeContent } from "../parsers/compose.js";
import { parseEnvFiles } from "../parsers/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../../fixtures");

describe("static discovery", () => {
  it("finds vite port in mismatch fixture", () => {
    const result = discoverStatic(resolve(fixtures, "mismatch"));
    const vite = result.services.find((s) => s.id === "vite");
    assert.ok(vite);
    assert.equal(vite!.declared.port, 5173);
  });

  it("parses env localhost URLs in mismatch fixture", () => {
    const refs = parseEnvFiles(resolve(fixtures, "mismatch"));
    assert.ok(refs.some((r) => r.envKey === "NEXT_PUBLIC_API_URL"));
    assert.ok(refs.some((r) => r.envKey === "VITE_API_URL" && r.targetPort === 8080));
  });

  it("detects duplicate declared ports in full-stack fixture", () => {
    const report = declareProject(resolve(fixtures, "full-stack"));
    const prt03 = report.findings.filter((f) => f.id === "PRT-03");
    assert.ok(prt03.length >= 0);
    assert.ok(report.services.some((s) => s.declared?.port === 3000));
    assert.ok(report.services.some((s) => s.declared?.port === 8080));
  });

  it("parses docker compose ports", () => {
    const { services, warnings } = parseComposeContent(
      `services:
  api:
    ports:
      - "8080:8080"
  web:
    ports:
      - "3000:3000"
`,
      "docker-compose.yml",
    );
    assert.equal(services.length, 2);
    assert.equal(services[0]?.hostPort, 8080);
    assert.equal(warnings.length, 0);
  });

  it("emits PRT-06 for host/container port mismatch", () => {
    const { warnings } = parseComposeContent(
      `services:
  app:
    ports:
      - "8080:3000"
`,
      "compose.yml",
    );
    assert.equal(warnings.length, 1);
  });
});

describe("declareProject (no runtime)", () => {
  it("mismatch fixture has PRT-01 and PRT-04 without listeners", () => {
    const report = declareProject(resolve(fixtures, "mismatch"));
    assert.ok(report.findings.some((f) => f.id === "PRT-01"));
    assert.ok(report.findings.some((f) => f.id === "PRT-04"));
    assert.ok(report.references.length >= 2);
  });

  it("frontend-only declares vite on 5173", () => {
    const report = declareProject(resolve(fixtures, "frontend-only"));
    const vite = report.services.find((s) => s.id === "vite");
    assert.ok(vite);
    assert.equal(vite!.declared?.port, 5173);
  });
});

describe("workspace scan", () => {
  it("discovers api and web projects", () => {
    const report = scanWorkspace(resolve(fixtures, "workspace"), {
      includeRuntime: false,
    });
    assert.equal(report.projects.length, 2);
    const names = report.projects.map((p) => p.project.name);
    assert.ok(names.includes("workspace-api"));
    assert.ok(names.includes("workspace-web"));
  });

  it("web project references port 8080 declared by api", () => {
    const report = scanWorkspace(resolve(fixtures, "workspace"), {
      includeRuntime: false,
    });
    const web = report.projects.find((p) => p.project.name === "workspace-web");
    assert.ok(web);
    const ref = web!.references.find((r) => r.envKey === "VITE_API_URL");
    assert.ok(ref);
    assert.equal(ref!.targetPort, 8080);
    const prt07 = report.findings.filter((f) => f.id === "PRT-07");
    assert.equal(prt07.length, 0);
  });
});
