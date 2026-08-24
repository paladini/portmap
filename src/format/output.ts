import type { Finding, PortMapReport, Severity, WorkspaceReport } from "../types.js";

export type OutputFormat = "text" | "json" | "markdown";

export function formatJson(report: PortMapReport | WorkspaceReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function formatPretty(report: PortMapReport): string {
  const lines: string[] = [];
  lines.push(`portmap — ${report.project.name}`);
  lines.push(`root: ${report.project.root}`);
  lines.push("");

  if (report.services.length === 0) {
    lines.push("No declared services found.");
  } else {
    lines.push("Services:");
    for (const svc of report.services) {
      const declared = svc.declared
        ? `declared :${svc.declared.port} (${svc.declared.sources[0] ?? "?"})`
        : "no declaration";
      const actual = svc.actual?.listening
        ? `listening :${svc.actual.port} pid=${svc.actual.pid}`
        : "not listening";
      lines.push(`  [${svc.status}] ${svc.id} — ${svc.label}`);
      lines.push(`    ${declared}`);
      lines.push(`    ${actual}`);
    }
  }

  if (report.references.length > 0) {
    lines.push("");
    lines.push("Env references:");
    for (const ref of report.references) {
      lines.push(
        `  ${ref.envKey}=${ref.value} → :${ref.targetPort ?? "?"} [${ref.status}] (${ref.sourceFile})`,
      );
    }
  }

  if (report.edges.length > 0) {
    lines.push("");
    lines.push("Edges:");
    for (const edge of report.edges) {
      lines.push(`  ${edge.from} → ${edge.to} via ${edge.via} (:${edge.port})`);
    }
  }

  const errors = report.findings.filter((f) => f.severity === "error");
  const warnings = report.findings.filter((f) => f.severity === "warning");

  lines.push("");
  lines.push(
    `Findings: ${errors.length} error(s), ${warnings.length} warning(s)`,
  );

  for (const finding of report.findings) {
    lines.push(formatFindingLine(finding));
  }

  return `${lines.join("\n")}\n`;
}

export function formatWorkspacePretty(report: WorkspaceReport): string {
  const lines: string[] = [];
  lines.push(`portmap workspace — ${report.workspaceRoot}`);
  lines.push(`projects: ${report.projects.length}`);
  lines.push("");

  for (const project of report.projects) {
    lines.push(`── ${project.project.name} (${project.project.root})`);
    for (const svc of project.services) {
      lines.push(
        `   ${svc.id}: declared :${svc.declared?.port ?? "?"} → ${svc.actual?.listening ? `listening :${svc.actual.port}` : "down"}`,
      );
    }
  }

  lines.push("");
  lines.push(`Findings: ${report.findings.length}`);
  for (const finding of report.findings) {
    lines.push(formatFindingLine(finding));
  }

  return `${lines.join("\n")}\n`;
}

export function formatMarkdown(report: PortMapReport): string {
  const lines: string[] = [];
  lines.push("# PortMap Report");
  lines.push("");
  lines.push(`- **Project:** ${report.project.name}`);
  lines.push(`- **Root:** \`${report.project.root}\``);
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push("");

  lines.push("## Services");
  lines.push("");
  lines.push("| ID | Label | Declared | Actual | Status |");
  lines.push("|----|-------|----------|--------|--------|");
  for (const svc of report.services) {
    lines.push(
      `| ${svc.id} | ${svc.label} | :${svc.declared?.port ?? "-"} | ${svc.actual?.listening ? `:${svc.actual.port}` : "-"} | ${svc.status} |`,
    );
  }

  if (report.findings.length > 0) {
    lines.push("");
    lines.push("## Findings");
    lines.push("");
    for (const f of report.findings) {
      lines.push(`- **${f.id}** (${f.severity}): ${f.message}`);
      if (f.fix) {
        lines.push(`  - Fix: ${f.fix}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatFindingLine(finding: Finding): string {
  const prefix =
    finding.severity === "error"
      ? "✖"
      : finding.severity === "warning"
        ? "⚠"
        : "·";
  const fix = finding.fix ? ` → ${finding.fix}` : "";
  return `  ${prefix} ${finding.id} ${finding.message}${fix}`;
}

export function countFindingsBySeverity(
  findings: Finding[],
  severity?: Severity,
): number {
  if (!severity) {
    return findings.length;
  }
  return findings.filter((f) => f.severity === severity).length;
}

export function slimGraph(report: PortMapReport): {
  services: PortMapReport["services"];
  edges: PortMapReport["edges"];
  references: PortMapReport["references"];
} {
  return {
    services: report.services,
    edges: report.edges,
    references: report.references,
  };
}
