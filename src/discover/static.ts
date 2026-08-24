import { resolve } from "node:path";
import type { StaticDiscoveryResult } from "../types.js";
import { parseEnvFiles } from "../parsers/env.js";
import { parseViteConfig, defaultVitePort } from "../parsers/vite.js";
import { parsePackageScripts, readPackageName } from "../parsers/packageScripts.js";
import { parseComposeFile } from "../parsers/compose.js";

export function discoverStatic(projectRoot: string): StaticDiscoveryResult {
  const root = resolve(projectRoot);
  const services: StaticDiscoveryResult["services"] = [];
  const portOwners = new Map<number, string>();

  const scriptPorts = parsePackageScripts(root);
  for (const script of scriptPorts) {
    services.push({
      id: script.id,
      label: script.label,
      role: script.role,
      declared: {
        port: script.port,
        host: "localhost",
        sources: script.sources.map((s) => `${s.file}:${s.detail}`),
      },
    });
    portOwners.set(script.port, script.id);
  }

  const vite = parseViteConfig(root);
  const hasViteScript = scriptPorts.some((s) => s.label.includes("vite"));
  if (hasViteScript || vite.port !== null) {
    const port = vite.port ?? defaultVitePort();
    if (!portOwners.has(port)) {
      services.push({
        id: "vite",
        label: "Vite dev server",
        role: "frontend",
        declared: {
          port,
          host: "localhost",
          sources:
            vite.sources.length > 0
              ? vite.sources.map((s) => `${s.file}:${s.detail}`)
              : ["vite.config (default 5173)"],
        },
      });
      portOwners.set(port, "vite");
    }
  }

  const compose = parseComposeFile(root);
  for (const svc of compose.services) {
    if (portOwners.has(svc.hostPort)) {
      continue;
    }
    services.push({
      id: svc.id,
      label: svc.label,
      role: svc.role,
      declared: {
        port: svc.hostPort,
        host: "localhost",
        sources: svc.sources.map((s) => `${s.file}:${s.detail}`),
      },
    });
    portOwners.set(svc.hostPort, svc.id);
  }

  const references = parseEnvFiles(root);

  return {
    services,
    references,
    composeWarnings: compose.warnings.map((w) => ({
      message: w.message,
      file: w.file,
      serviceId: w.serviceId,
    })),
  };
}

export { readPackageName };
