import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PortSource, ServiceRole } from "../types.js";

const COMPOSE_FILES = [
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
];

export interface ComposeService {
  id: string;
  label: string;
  role: ServiceRole;
  hostPort: number;
  containerPort: number;
  sources: PortSource[];
}

export interface ComposeWarning {
  message: string;
  file: string;
  serviceId?: string;
}

export function parseComposeFile(projectRoot: string): {
  services: ComposeService[];
  warnings: ComposeWarning[];
} {
  for (const name of COMPOSE_FILES) {
    const filePath = join(projectRoot, name);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    return parseComposeContent(content, name);
  }

  return { services: [], warnings: [] };
}

export function parseComposeContent(
  content: string,
  fileName: string,
): { services: ComposeService[]; warnings: ComposeWarning[] } {
  const services: ComposeService[] = [];
  const warnings: ComposeWarning[] = [];

  const serviceBlocks = content.split(/^  ([a-zA-Z0-9_-]+):\s*$/m);
  for (let i = 1; i < serviceBlocks.length; i += 2) {
    const serviceName = serviceBlocks[i];
    const block = serviceBlocks[i + 1] ?? "";
    if (!serviceName) {
      continue;
    }

    const portsSection = block.match(/ports:\s*\n((?:\s+-\s+.+\n?)+)/);
    if (!portsSection?.[1]) {
      continue;
    }

    const portLines = portsSection[1].match(/^\s+-\s+(.+)$/gm) ?? [];
    for (const line of portLines) {
      const valueMatch = line.match(/^\s+-\s+["']?([^"'\n]+)["']?/);
      if (!valueMatch?.[1]) {
        continue;
      }

      const mapping = valueMatch[1].trim();
      const parts = mapping.split(":");
      if (parts.length < 2) {
        continue;
      }

      const hostPort = parsePortToken(parts[0] ?? "");
      const containerPort = parsePortToken(parts[parts.length - 1] ?? "");
      if (hostPort === null || containerPort === null) {
        continue;
      }

      const role = inferRole(serviceName);
      const sources: PortSource[] = [
        { file: fileName, detail: `services.${serviceName}.ports` },
      ];

      services.push({
        id: `compose-${serviceName}`,
        label: `Docker: ${serviceName}`,
        role,
        hostPort,
        containerPort,
        sources,
      });

      if (hostPort !== containerPort) {
        warnings.push({
          message: `Host port ${hostPort} maps to container port ${containerPort}`,
          file: fileName,
          serviceId: `compose-${serviceName}`,
        });
      }
    }
  }

  return { services, warnings };
}

function parsePortToken(token: string): number | null {
  const cleaned = token.replace(/["']/g, "").trim();
  const portPart = cleaned.includes("-") ? cleaned.split("-")[0] : cleaned;
  const port = Number.parseInt(portPart ?? "", 10);
  return Number.isFinite(port) && port > 0 && port <= 65535 ? port : null;
}

function inferRole(serviceName: string): ServiceRole {
  const lower = serviceName.toLowerCase();
  if (
    lower.includes("postgres") ||
    lower.includes("mysql") ||
    lower.includes("redis") ||
    lower.includes("mongo") ||
    lower.includes("db")
  ) {
    return "database";
  }
  if (lower.includes("api") || lower.includes("backend") || lower.includes("server")) {
    return "api";
  }
  if (lower.includes("web") || lower.includes("frontend") || lower.includes("app")) {
    return "frontend";
  }
  return "other";
}
