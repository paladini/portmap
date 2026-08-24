import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PortSource, ServiceRole } from "../types.js";

interface ScriptPort {
  port: number;
  sources: PortSource[];
  label: string;
  role: ServiceRole;
  id: string;
}

const PORT_FLAG = /(?:^|\s)(?:-p|--port)(?:=|\s+)(\d+)/;
const PORT_ENV_PREFIX = /(?:^|\s)(?:PORT|NEXT_PORT|VITE_PORT)=(\d+)/;

export function parsePackageScripts(projectRoot: string): ScriptPort[] {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) {
    return [];
  }

  let pkg: { name?: string; scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      name?: string;
      scripts?: Record<string, string>;
    };
  } catch {
    return [];
  }

  const scripts = pkg.scripts ?? {};
  const results: ScriptPort[] = [];
  const seenPorts = new Set<number>();

  for (const [scriptName, command] of Object.entries(scripts)) {
    if (!command) {
      continue;
    }

    const isDev =
      scriptName === "dev" ||
      scriptName === "start" ||
      scriptName.startsWith("dev:") ||
      scriptName.includes("serve");

    if (!isDev && !command.includes("next") && !command.includes("vite")) {
      continue;
    }

    let port: number | null = null;
    const sources: PortSource[] = [];

    const flagMatch = command.match(PORT_FLAG);
    if (flagMatch?.[1]) {
      port = Number.parseInt(flagMatch[1], 10);
      sources.push({
        file: "package.json",
        detail: `scripts.${scriptName} (-p/--port)`,
      });
    }

    const envMatch = command.match(PORT_ENV_PREFIX);
    if (envMatch?.[1]) {
      port = Number.parseInt(envMatch[1], 10);
      sources.push({
        file: "package.json",
        detail: `scripts.${scriptName} (PORT=)`,
      });
    }

    if (port === null && command.includes("next dev")) {
      port = 3000;
      sources.push({
        file: "package.json",
        detail: `scripts.${scriptName} (next default)`,
      });
    }

    if (port === null && command.includes("vite")) {
      continue;
    }

    if (port === null || !Number.isFinite(port) || seenPorts.has(port)) {
      continue;
    }

    seenPorts.add(port);

    const role: ServiceRole = command.includes("next") || command.includes("vite")
      ? "frontend"
      : "other";

    results.push({
      port,
      sources,
      label: `${scriptName} (${command.slice(0, 40)}${command.length > 40 ? "…" : ""})`,
      role,
      id: scriptName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "dev",
    });
  }

  return results;
}

export function readPackageName(projectRoot: string): string {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) {
    return projectRoot.split(/[/\\]/).pop() ?? "project";
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    return pkg.name?.split("/").pop() ?? projectRoot.split(/[/\\]/).pop() ?? "project";
  } catch {
    return projectRoot.split(/[/\\]/).pop() ?? "project";
  }
}
