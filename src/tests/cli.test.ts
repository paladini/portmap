import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const cli = resolve(root, "dist/cli.js");
const mismatch = resolve(root, "fixtures/mismatch");

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: root,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("CLI", () => {
  it("prints help", () => {
    const result = run(["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /portmap scan/);
  });

  it("scan --json outputs valid JSON", () => {
    const result = run(["scan", mismatch, "--json"]);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout) as { schema: string; findings: unknown[] };
    assert.equal(parsed.schema, "portmap-v1");
    assert.ok(Array.isArray(parsed.findings));
  });

  it("declare exits 0 without runtime", () => {
    const result = run(["declare", mismatch, "--json"]);
    assert.equal(result.status, 0);
  });

  it("--min-findings exits 1 when threshold met", () => {
    const result = run(["declare", mismatch, "--min-findings", "1", "--quiet"]);
    assert.equal(result.status, 1);
  });

  it("workspace command runs on fixtures", () => {
    const ws = resolve(root, "fixtures/workspace");
    const result = run(["workspace", ws, "--json"]);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout) as { projects: unknown[] };
    assert.equal(parsed.projects.length, 2);
  });
});
