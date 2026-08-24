#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  countFindingsBySeverity,
  formatJson,
  formatMarkdown,
  formatPretty,
  formatWorkspacePretty,
  type OutputFormat,
} from "./format/output.js";
import { scanProject, declareProject } from "./discover/reconcile.js";
import { scanListeners } from "./discover/runtime.js";
import { scanWorkspace } from "./discover/workspace.js";
import { startMcpServer } from "./mcp/server.js";
import type { PortMapReport, Severity } from "./types.js";

type Command = "scan" | "listen" | "declare" | "workspace" | "mcp";

interface GlobalOptions {
  format: OutputFormat;
  out: string | null;
  quiet: boolean;
  write: boolean;
  minFindings: number | null;
  minSeverity: Severity | null;
}

function readPackageVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printHelp(version: string): void {
  process.stdout.write(`portmap v${version}
Local service topology for AI agents — declared ports, runtime listeners, env graph.

Usage:
  portmap scan [path]       Full scan (static + OS listeners)
  portmap declare [path]    Static config only (no OS scan)
  portmap listen            List OS listeners only
  portmap workspace [dir]   Multi-project workspace scan
  portmap mcp               Start MCP stdio server (read-only)

Options:
  --json            JSON output
  --markdown        Markdown report
  --write           Write .portmap.json to project root
  --out <file>      Write report to file
  --quiet           Suppress non-report stdout
  --min-findings N  Exit 1 if findings count >= N
  --min-severity S  Count only error|warning|info findings (with --min-findings)
  -h, --help        Show help

Examples:
  portmap scan .
  portmap scan fixtures/mismatch --json
  portmap workspace ~/code --min-findings 1
  portmap declare . --write
`);
}

function parseGlobalOptions(args: string[]): { options: GlobalOptions; rest: string[] } {
  const rest: string[] = [];
  const options: GlobalOptions = {
    format: "text",
    out: null,
    quiet: false,
    write: false,
    minFindings: null,
    minSeverity: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--json") {
      options.format = "json";
      continue;
    }
    if (arg === "--markdown") {
      options.format = "markdown";
      continue;
    }
    if (arg === "--quiet") {
      options.quiet = true;
      continue;
    }
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--out") {
      options.out = args[i + 1] ?? null;
      if (!options.out) {
        throw new Error("--out requires a path");
      }
      i += 1;
      continue;
    }
    if (arg === "--min-findings") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("--min-findings requires a number");
      }
      options.minFindings = Number.parseInt(value, 10);
      i += 1;
      continue;
    }
    if (arg === "--min-severity") {
      const value = args[i + 1];
      if (value !== "error" && value !== "warning" && value !== "info") {
        throw new Error("--min-severity must be error, warning, or info");
      }
      options.minSeverity = value;
      i += 1;
      continue;
    }
    rest.push(arg);
  }

  return { options, rest };
}

function writeOutput(content: string, outPath: string | null): void {
  if (!outPath) {
    process.stdout.write(content);
    return;
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, "utf8");
}

function writePortMapJson(report: PortMapReport, projectRoot: string): void {
  const outPath = resolve(projectRoot, ".portmap.json");
  writeFileSync(outPath, formatJson(report), "utf8");
}

function checkMinFindings(
  findings: PortMapReport["findings"],
  options: GlobalOptions,
): number {
  if (options.minFindings === null) {
    return 0;
  }
  const count = options.minSeverity
    ? countFindingsBySeverity(findings, options.minSeverity)
    : findings.length;
  return count >= options.minFindings ? 1 : 0;
}

function formatReport(report: PortMapReport, format: OutputFormat): string {
  if (format === "json") {
    return formatJson(report);
  }
  if (format === "markdown") {
    return formatMarkdown(report);
  }
  return formatPretty(report);
}

async function main(): Promise<number> {
  const version = readPackageVersion();
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    printHelp(version);
    return 0;
  }

  const command = argv[0] as Command;
  const { options, rest } = parseGlobalOptions(argv.slice(1));
  const targetPath = resolve(rest[0] ?? process.cwd());

  try {
    if (command === "mcp") {
      await startMcpServer();
      return 0;
    }

    if (command === "listen") {
      const listeners = scanListeners();
      if (options.format === "json") {
        writeOutput(`${JSON.stringify({ listeners }, null, 2)}\n`, options.out);
      } else {
        const lines = listeners.map(
          (l) => `:${l.port}  pid=${l.pid}  ${l.process}  ${l.command.slice(0, 60)}`,
        );
        writeOutput(`${lines.join("\n")}\n`, options.out);
      }
      return 0;
    }

    if (command === "declare") {
      const report = declareProject(targetPath);
      const output = formatReport(report, options.format);
      if (!options.quiet) {
        writeOutput(output, options.out);
      }
      if (options.write) {
        writePortMapJson(report, targetPath);
      }
      return checkMinFindings(report.findings, options);
    }

    if (command === "workspace") {
      const report = scanWorkspace(targetPath);
      const output =
        options.format === "json"
          ? formatJson(report)
          : formatWorkspacePretty(report);
      if (!options.quiet) {
        writeOutput(output, options.out);
      }
      return checkMinFindings(report.findings, options);
    }

    if (command === "scan") {
      const report = scanProject(targetPath);
      const output = formatReport(report, options.format);
      if (!options.quiet) {
        writeOutput(output, options.out);
      }
      if (options.write) {
        writePortMapJson(report, targetPath);
      }
      return checkMinFindings(report.findings, options);
    }

    process.stderr.write(`Unknown command: ${command}\n`);
    printHelp(version);
    return 2;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`portmap: ${message}\n`);
    return 2;
  }
}

main().then((code) => {
  process.exitCode = code;
});
