export const SCHEMA_VERSION = "portmap-v1" as const;

export type FindingId =
  | "PRT-01"
  | "PRT-02"
  | "PRT-03"
  | "PRT-04"
  | "PRT-05"
  | "PRT-06"
  | "PRT-07";

export type Severity = "error" | "warning" | "info";

export type ServiceRole = "frontend" | "api" | "database" | "worker" | "other";

export type ServiceStatus = "ok" | "down" | "mismatch" | "conflict" | "orphan";

export type ReferenceStatus = "resolved" | "unresolved" | "mismatch";

export type AttributionConfidence = "high" | "low";

export interface PortSource {
  file: string;
  line?: number;
  detail: string;
}

export interface DeclaredPort {
  port: number;
  host: string;
  sources: string[];
}

export interface ActualPort {
  listening: boolean;
  port: number;
  pid?: number;
  process?: string;
  command?: string;
  url: string;
  attribution?: AttributionConfidence;
}

export interface Service {
  id: string;
  label: string;
  role: ServiceRole;
  declared: DeclaredPort | null;
  actual: ActualPort | null;
  status: ServiceStatus;
}

export interface EnvReference {
  envKey: string;
  value: string;
  targetPort: number | null;
  host: string | null;
  sourceFile: string;
  resolvedService: string | null;
  status: ReferenceStatus;
}

export interface ServiceEdge {
  from: string;
  to: string;
  via: string;
  port: number;
}

export interface Listener {
  port: number;
  pid: number;
  process: string;
  command: string;
  attributedProject: string | null;
  attribution: AttributionConfidence;
}

export interface Finding {
  id: FindingId;
  severity: Severity;
  message: string;
  fix?: string;
  file?: string;
  serviceId?: string;
}

export interface ProjectInfo {
  name: string;
  root: string;
}

export interface PortMapReport {
  schema: typeof SCHEMA_VERSION;
  generatedAt: string;
  project: ProjectInfo;
  services: Service[];
  references: EnvReference[];
  edges: ServiceEdge[];
  listeners: Listener[];
  findings: Finding[];
}

export interface WorkspaceReport {
  schema: typeof SCHEMA_VERSION;
  generatedAt: string;
  workspaceRoot: string;
  projects: PortMapReport[];
  findings: Finding[];
}

export interface StaticDiscoveryResult {
  services: Array<{
    id: string;
    label: string;
    role: ServiceRole;
    declared: DeclaredPort;
  }>;
  references: EnvReference[];
  composeWarnings: Array<{ message: string; file: string; serviceId?: string }>;
}

export interface RuntimeListener {
  port: number;
  pid: number;
  process: string;
  command: string;
  cwd?: string;
}

export interface ScanOptions {
  includeRuntime?: boolean;
  listeners?: RuntimeListener[];
}

export const FINDING_META: Record<
  FindingId,
  { severity: Severity; template: string }
> = {
  "PRT-01": {
    severity: "error",
    template: "Declared port {port} is not listening ({source})",
  },
  "PRT-02": {
    severity: "warning",
    template: "Listener on port {port} (PID {pid}) has no declared config in this project",
  },
  "PRT-03": {
    severity: "error",
    template: "Multiple services declare port {port}: {services}",
  },
  "PRT-04": {
    severity: "error",
    template: "{envKey} points to localhost:{port} but nothing is listening",
  },
  "PRT-05": {
    severity: "warning",
    template: "Listener on port {actualPort} differs from declared port {declaredPort} ({source})",
  },
  "PRT-06": {
    severity: "warning",
    template: "Docker compose maps host:{hostPort} to container:{containerPort} — verify app listens on container port",
  },
  "PRT-07": {
    severity: "error",
    template: "{envKey} references localhost:{port} but no project in workspace declares or listens on that port",
  },
};
