import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { scanProject } from "../discover/reconcile.js";
import { countFindingsBySeverity, slimGraph } from "../format/output.js";
import type { PortMapReport, Severity } from "../types.js";

const pathSchema = z.object({
  path: z.string().optional(),
});

const resolveUrlSchema = z.object({
  envKey: z.string(),
  path: z.string().optional(),
});

const findingsSchema = z.object({
  path: z.string().optional(),
  severity: z.enum(["error", "warning", "info"]).optional(),
});

function resolvePath(input?: string): string {
  return resolve(input ?? process.cwd());
}

function filterFindings(report: PortMapReport, severity?: Severity) {
  if (!severity) {
    return report.findings;
  }
  return report.findings.filter((f) => f.severity === severity);
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: "portmap",
    version: "0.1.0",
  });

  server.tool(
    "portmap_scan",
    "Run a full portmap scan (static configs + OS listeners) and return .portmap.json report",
    pathSchema.shape,
    async ({ path }) => {
      const report = scanProject(resolvePath(path));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "portmap_graph",
    "Return slim service graph: services, edges, and env references",
    pathSchema.shape,
    async ({ path }) => {
      const report = scanProject(resolvePath(path));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(slimGraph(report), null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "portmap_resolve_url",
    "Resolve an env key to its localhost URL and report if broken",
    resolveUrlSchema.shape,
    async ({ envKey, path }) => {
      const report = scanProject(resolvePath(path));
      const ref = report.references.find((r) => r.envKey === envKey);
      if (!ref) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                envKey,
                found: false,
                message: `No localhost reference found for ${envKey}`,
              }),
            },
          ],
        };
      }

      const relatedFindings = report.findings.filter(
        (f) => f.file === ref.sourceFile || f.message.includes(envKey),
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                envKey,
                value: ref.value,
                targetPort: ref.targetPort,
                status: ref.status,
                resolvedService: ref.resolvedService,
                sourceFile: ref.sourceFile,
                ok: ref.status === "resolved",
                findings: relatedFindings,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "portmap_findings",
    "List portmap findings (PRT-*) optionally filtered by severity",
    findingsSchema.shape,
    async ({ path, severity }) => {
      const report = scanProject(resolvePath(path));
      const findings = filterFindings(report, severity);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: findings.length,
                errors: countFindingsBySeverity(findings, "error"),
                warnings: countFindingsBySeverity(findings, "warning"),
                findings,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
