import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PortSource } from "../types.js";

const VITE_CONFIG_NAMES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.cjs",
];

export function parseViteConfig(projectRoot: string): {
  port: number | null;
  sources: PortSource[];
} {
  for (const name of VITE_CONFIG_NAMES) {
    const filePath = join(projectRoot, name);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    const sources: PortSource[] = [];

    const serverPortMatch = content.match(
      /server\s*:\s*\{[^}]*port\s*:\s*(\d+)/s,
    );
    if (serverPortMatch?.[1]) {
      const port = Number.parseInt(serverPortMatch[1], 10);
      if (Number.isFinite(port)) {
        sources.push({ file: name, detail: "server.port" });
        return { port, sources };
      }
    }

    const inlinePortMatch = content.match(/port\s*:\s*(\d+)/);
    if (inlinePortMatch?.[1]) {
      const port = Number.parseInt(inlinePortMatch[1], 10);
      if (Number.isFinite(port)) {
        sources.push({ file: name, detail: "port" });
        return { port, sources };
      }
    }
  }

  return { port: null, sources: [] };
}

export function defaultVitePort(): number {
  return 5173;
}
