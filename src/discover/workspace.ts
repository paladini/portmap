import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Finding, PortMapReport, WorkspaceReport } from "../types.js";
import { SCHEMA_VERSION } from "../types.js";
import { scanProject } from "./reconcile.js";

export function scanWorkspace(
  workspaceRoot: string,
  options: { includeRuntime?: boolean } = {},
): WorkspaceReport {
  const root = resolve(workspaceRoot);
  const projectRoots = discoverProjects(root);
  const projects = projectRoots.map((p) =>
    scanProject(p, { includeRuntime: options.includeRuntime !== false }),
  );

  const findings: Finding[] = [];
  for (const project of projects) {
    findings.push(...project.findings);
  }

  findings.push(...resolveCrossProjectReferences(projects));

  return {
    schema: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    workspaceRoot: root,
    projects,
    findings: dedupeFindings(findings),
  };
}

function discoverProjects(workspaceRoot: string): string[] {
  const projects: string[] = [];

  if (hasProjectMarker(workspaceRoot)) {
    projects.push(workspaceRoot);
  }

  let entries: string[];
  try {
    entries = readdirSync(workspaceRoot);
  } catch {
    return projects.length > 0 ? projects : [workspaceRoot];
  }

  for (const entry of entries) {
    if (entry === "node_modules" || entry.startsWith(".")) {
      continue;
    }
    const fullPath = join(workspaceRoot, entry);
    try {
      if (!statSync(fullPath).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    if (hasProjectMarker(fullPath)) {
      projects.push(fullPath);
    }
  }

  return projects.length > 0 ? projects : [workspaceRoot];
}

function hasProjectMarker(dir: string): boolean {
  return (
    existsSync(join(dir, "package.json")) ||
    existsSync(join(dir, "docker-compose.yml")) ||
    existsSync(join(dir, "docker-compose.yaml")) ||
    existsSync(join(dir, "compose.yml"))
  );
}

function resolveCrossProjectReferences(projects: PortMapReport[]): Finding[] {
  const findings: Finding[] = [];
  const listeningPorts = new Map<number, string>();
  const declaredPorts = new Map<number, string>();

  for (const project of projects) {
    for (const svc of project.services) {
      if (svc.declared) {
        declaredPorts.set(svc.declared.port, project.project.name);
      }
      if (svc.actual?.listening) {
        listeningPorts.set(svc.actual.port, project.project.name);
      }
    }
  }

  for (const project of projects) {
    for (const ref of project.references) {
      if (ref.status === "resolved") {
        continue;
      }
      if (ref.targetPort === null) {
        continue;
      }

      const listenerProject = listeningPorts.get(ref.targetPort);
      const declaredProject = declaredPorts.get(ref.targetPort);

      if (listenerProject || declaredProject) {
        ref.resolvedService = declaredProject ?? listenerProject ?? null;
        ref.status = listenerProject ? "resolved" : "unresolved";
        continue;
      }

      if (ref.status === "unresolved") {
        findings.push({
          id: "PRT-07",
          severity: "error",
          message: `${ref.envKey} references localhost:${ref.targetPort} but no project in workspace declares or listens on that port`,
          fix: "Start the dependent service or fix the env URL across workspace projects",
          file: ref.sourceFile,
        });
      }
    }
  }

  return findings;
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.id}:${f.message}:${f.file ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
