import { resolve } from "node:path";
import type {
  EnvReference,
  Finding,
  Listener,
  PortMapReport,
  RuntimeListener,
  ScanOptions,
  Service,
  ServiceEdge,
  ServiceStatus,
  StaticDiscoveryResult,
} from "../types.js";
import { SCHEMA_VERSION } from "../types.js";
import { discoverStatic, readPackageName } from "./static.js";
import { attributeListenerToProject, scanListeners } from "./runtime.js";

export function scanProject(
  projectRoot: string,
  options: ScanOptions = {},
): PortMapReport {
  const root = resolve(projectRoot);
  const staticResult = discoverStatic(root);
  const listeners =
    options.listeners ??
    (options.includeRuntime !== false ? scanListeners() : []);

  return reconcile(root, staticResult, listeners);
}

export function declareProject(projectRoot: string): PortMapReport {
  return scanProject(projectRoot, { includeRuntime: false, listeners: [] });
}

function reconcile(
  projectRoot: string,
  staticResult: StaticDiscoveryResult,
  listeners: RuntimeListener[],
): PortMapReport {
  const findings: Finding[] = [];
  const listenerByPort = new Map(listeners.map((l) => [l.port, l]));

  const portToServiceIds = new Map<number, string[]>();
  for (const svc of staticResult.services) {
    const port = svc.declared.port;
    const ids = portToServiceIds.get(port) ?? [];
    ids.push(svc.id);
    portToServiceIds.set(port, ids);
  }

  for (const [port, ids] of portToServiceIds) {
    if (ids.length > 1) {
      findings.push({
        id: "PRT-03",
        severity: "error",
        message: `Multiple services declare port ${port}: ${ids.join(", ")}`,
        fix: "Use distinct ports or consolidate into one service entry",
      });
    }
  }

  for (const warning of staticResult.composeWarnings) {
    findings.push({
      id: "PRT-06",
      severity: "warning",
      message: warning.message,
      fix: "Ensure the app inside the container listens on the container port, not the host port",
      file: warning.file,
      serviceId: warning.serviceId,
    });
  }

  const services: Service[] = staticResult.services.map((svc) => {
    const listener = listenerByPort.get(svc.declared.port);
    let status: ServiceStatus = "down";
    let actual = null;

    if (listener) {
      const attribution = attributeListenerToProject(listener, projectRoot);
      actual = {
        listening: true,
        port: listener.port,
        pid: listener.pid,
        process: listener.process,
        command: listener.command,
        url: `http://localhost:${listener.port}`,
        attribution: attribution.confidence,
      };

      if (listener.port === svc.declared.port) {
        status = "ok";
      } else {
        status = "mismatch";
        findings.push({
          id: "PRT-05",
          severity: "warning",
          message: `Listener on port ${listener.port} differs from declared port ${svc.declared.port} (${svc.declared.sources[0] ?? "unknown"})`,
          fix: "Check if the dev server bumped ports (e.g. Vite strictPort: false) or update config",
          serviceId: svc.id,
        });
      }
    } else {
      findings.push({
        id: "PRT-01",
        severity: "error",
        message: `Declared port ${svc.declared.port} is not listening (${svc.declared.sources[0] ?? svc.label})`,
        fix: `Start ${svc.label} or verify the declared port in config`,
        serviceId: svc.id,
      });
    }

    return {
      id: svc.id,
      label: svc.label,
      role: svc.role,
      declared: svc.declared,
      actual,
      status,
    };
  });

  const declaredPorts = new Set(staticResult.services.map((s) => s.declared.port));
  const reportListeners: Listener[] = [];

  for (const listener of listeners) {
    const attribution = attributeListenerToProject(listener, projectRoot);
    const isDeclared = declaredPorts.has(listener.port);

    reportListeners.push({
      port: listener.port,
      pid: listener.pid,
      process: listener.process,
      command: listener.command,
      attributedProject: attribution.matched ? projectRoot : null,
      attribution: attribution.confidence,
    });

    if (!isDeclared && attribution.matched) {
      findings.push({
        id: "PRT-02",
        severity: "warning",
        message: `Listener on port ${listener.port} (PID ${listener.pid}) has no declared config in this project`,
        fix: "Add port to vite.config, package.json scripts, or docker-compose if this service belongs here",
      });
    }
  }

  const references = resolveReferences(
    staticResult.references,
    services,
    listenerByPort,
    findings,
  );

  const edges = buildEdges(services, references);

  return {
    schema: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    project: {
      name: readPackageName(projectRoot),
      root: projectRoot,
    },
    services,
    references,
    edges,
    listeners: reportListeners,
    findings: dedupeFindings(findings),
  };
}

function resolveReferences(
  references: EnvReference[],
  services: Service[],
  listenerByPort: Map<number, RuntimeListener>,
  findings: Finding[],
): EnvReference[] {
  return references.map((ref) => {
    if (ref.targetPort === null) {
      return ref;
    }

    const targetService = services.find(
      (s) => s.declared?.port === ref.targetPort,
    );
    const isListening = listenerByPort.has(ref.targetPort);

    if (targetService && isListening) {
      return {
        ...ref,
        resolvedService: targetService.id,
        status: "resolved" as const,
      };
    }

    if (targetService && !isListening) {
      findings.push({
        id: "PRT-04",
        severity: "error",
        message: `${ref.envKey} points to localhost:${ref.targetPort} but nothing is listening`,
        fix: `Start ${targetService.label} or update ${ref.sourceFile}`,
        file: ref.sourceFile,
      });
      return { ...ref, resolvedService: targetService.id, status: "unresolved" as const };
    }

    if (!isListening) {
      findings.push({
        id: "PRT-04",
        severity: "error",
        message: `${ref.envKey} points to localhost:${ref.targetPort} but nothing is listening`,
        fix: `Start the service on port ${ref.targetPort} or update ${ref.sourceFile}`,
        file: ref.sourceFile,
      });
    }

    return { ...ref, status: isListening ? ("mismatch" as const) : ("unresolved" as const) };
  });
}

function buildEdges(services: Service[], references: EnvReference[]): ServiceEdge[] {
  const edges: ServiceEdge[] = [];
  const frontend = services.find((s) => s.role === "frontend") ?? services[0];

  if (!frontend) {
    return edges;
  }

  for (const ref of references) {
    if (ref.targetPort === null) {
      continue;
    }
    const target = services.find((s) => s.id === ref.resolvedService);
    edges.push({
      from: frontend.id,
      to: target?.id ?? "external",
      via: ref.envKey,
      port: ref.targetPort,
    });
  }

  return edges;
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const result: Finding[] = [];
  for (const f of findings) {
    const key = `${f.id}:${f.message}:${f.file ?? ""}:${f.serviceId ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(f);
  }
  return result;
}

export { reconcile };
