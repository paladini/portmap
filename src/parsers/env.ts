import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { EnvReference } from "../types.js";

const LOCALHOST_URL =
  /^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|\[::1\])(?::(\d+))?(?:\/.*)?$/i;

const ENV_FILES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.example",
];

const URL_KEYS = /(?:^|_)(?:URL|URI|HOST|ORIGIN|ENDPOINT|BASE)(?:_|$)/i;
const PORT_KEYS = /^(?:PORT|VITE_PORT|NEXT_PUBLIC_PORT|NUXT_PORT|PUBLIC_PORT)$/i;

export function parseEnvFiles(projectRoot: string): EnvReference[] {
  const references: EnvReference[] = [];

  for (const envFile of ENV_FILES) {
    const filePath = join(projectRoot, envFile);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]?.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) {
        continue;
      }

      const key = match[1] ?? "";
      let value = match[2] ?? "";
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      const sourceFile = `${envFile}:${i + 1}`;

      if (PORT_KEYS.test(key)) {
        const port = Number.parseInt(value, 10);
        if (Number.isFinite(port) && port > 0 && port <= 65535) {
          references.push({
            envKey: key,
            value,
            targetPort: port,
            host: "localhost",
            sourceFile,
            resolvedService: null,
            status: "unresolved",
          });
        }
        continue;
      }

      if (!URL_KEYS.test(key) && key !== "API_URL" && !key.endsWith("_API_URL")) {
        continue;
      }

      const urlMatch = value.match(LOCALHOST_URL);
      if (!urlMatch) {
        continue;
      }

      const portStr = urlMatch[1];
      const targetPort = portStr ? Number.parseInt(portStr, 10) : 80;

      references.push({
        envKey: key,
        value,
        targetPort: Number.isFinite(targetPort) ? targetPort : null,
        host: "localhost",
        sourceFile,
        resolvedService: null,
        status: "unresolved",
      });
    }
  }

  return references;
}

export function extractLocalhostPort(value: string): number | null {
  const match = value.match(LOCALHOST_URL);
  if (!match) {
    return null;
  }
  const portStr = match[1];
  if (!portStr) {
    return 80;
  }
  const port = Number.parseInt(portStr, 10);
  return Number.isFinite(port) ? port : null;
}
