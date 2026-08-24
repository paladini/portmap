import { execSync } from "node:child_process";
import { platform } from "node:os";
import type { RuntimeListener } from "../types.js";

export function scanListeners(): RuntimeListener[] {
  const os = platform();
  if (os === "win32") {
    return scanWindows();
  }
  return scanUnix();
}

function scanWindows(): RuntimeListener[] {
  try {
    const psScript = [
      "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue",
      "| Select-Object LocalPort,OwningProcess",
      "| ForEach-Object {",
      "  $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue",
      "  [PSCustomObject]@{",
      "    port=$_.LocalPort;",
      "    pid=$_.OwningProcess;",
      "    process=if($p){$p.ProcessName}else{'unknown'};",
      "    command=if($p){$p.Path}else{''}",
      "  }",
      "}",
      "| ConvertTo-Json -Compress",
    ].join(" ");

    const output = execSync(`powershell -NoProfile -Command "${psScript}"`, {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!output) {
      return scanWindowsNetstat();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch {
      return scanWindowsNetstat();
    }

    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return normalizeListeners(
      rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          port: Number(r.port),
          pid: Number(r.pid),
          process: String(r.process ?? "unknown"),
          command: String(r.command ?? ""),
        };
      }),
    );
  } catch {
    return scanWindowsNetstat();
  }
}

function scanWindowsNetstat(): RuntimeListener[] {
  try {
    const output = execSync("netstat -ano", {
      encoding: "utf8",
      timeout: 15000,
    });

    const listeners: Array<{ port: number; pid: number }> = [];
    for (const line of output.split(/\r?\n/)) {
      const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
      if (!match?.[1] || !match[2]) {
        continue;
      }
      const port = Number.parseInt(match[1], 10);
      const pid = Number.parseInt(match[2], 10);
      if (Number.isFinite(port) && Number.isFinite(pid)) {
        listeners.push({ port, pid });
      }
    }

    return normalizeListeners(
      listeners.map(({ port, pid }) => ({
        port,
        pid,
        process: resolveProcessName(pid),
        command: resolveWindowsCommand(pid),
      })),
    );
  } catch {
    return [];
  }
}

function scanUnix(): RuntimeListener[] {
  try {
    const output = execSync("ss -tlnp 2>/dev/null || lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null", {
      encoding: "utf8",
      timeout: 15000,
      shell: "/bin/sh",
    });

    const listeners: RuntimeListener[] = [];

    for (const line of output.split(/\r?\n/)) {
      const ssMatch = line.match(/LISTEN\s+\S+:(\d+)\s.*users:\(\("([^"]+)",pid=(\d+)/);
      if (ssMatch?.[1] && ssMatch[2] && ssMatch[3]) {
        listeners.push({
          port: Number.parseInt(ssMatch[1], 10),
          pid: Number.parseInt(ssMatch[3], 10),
          process: ssMatch[2],
          command: line.trim(),
        });
        continue;
      }

      const lsofMatch = line.match(/^(\S+)\s+\d+\s+\S+\s+(\d+)\s+\S+\s+TCP\s+\*:(\d+)\s+\(LISTEN\)/);
      if (lsofMatch?.[1] && lsofMatch[2] && lsofMatch[3]) {
        listeners.push({
          port: Number.parseInt(lsofMatch[3], 10),
          pid: Number.parseInt(lsofMatch[2], 10),
          process: lsofMatch[1],
          command: line.trim(),
        });
      }
    }

    return normalizeListeners(listeners);
  } catch {
    return [];
  }
}

function normalizeListeners(
  raw: Array<{ port: number; pid: number; process: string; command: string }>,
): RuntimeListener[] {
  const byPort = new Map<number, RuntimeListener>();

  for (const item of raw) {
    if (!Number.isFinite(item.port) || item.port <= 0 || item.port > 65535) {
      continue;
    }
    if (!Number.isFinite(item.pid) || item.pid <= 0) {
      continue;
    }
    if (item.port < 1024 && item.port !== 80 && item.port !== 443) {
      continue;
    }

    const existing = byPort.get(item.port);
    if (!existing || existing.pid > item.pid) {
      byPort.set(item.port, {
        port: item.port,
        pid: item.pid,
        process: item.process,
        command: item.command,
      });
    }
  }

  return [...byPort.values()].sort((a, b) => a.port - b.port);
}

function resolveProcessName(pid: number): string {
  try {
    const output = execSync(
      `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName"`,
      { encoding: "utf8", timeout: 5000 },
    ).trim();
    return output || "unknown";
  } catch {
    return "unknown";
  }
}

function resolveWindowsCommand(pid: number): string {
  try {
    const output = execSync(
      `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId=${pid}\\" -ErrorAction SilentlyContinue).CommandLine"`,
      { encoding: "utf8", timeout: 5000 },
    ).trim();
    return output || "";
  } catch {
    return "";
  }
}

export function attributeListenerToProject(
  listener: RuntimeListener,
  projectRoot: string,
): { confidence: "high" | "low"; matched: boolean } {
  const normalizedRoot = projectRoot.replace(/\\/g, "/").toLowerCase();
  const cmd = listener.command.replace(/\\/g, "/").toLowerCase();
  const cwd = listener.cwd?.replace(/\\/g, "/").toLowerCase() ?? "";

  if (cwd && cwd.startsWith(normalizedRoot)) {
    return { confidence: "high", matched: true };
  }
  if (cmd.includes(normalizedRoot)) {
    return { confidence: "high", matched: true };
  }
  if (cmd.length > 0) {
    return { confidence: "low", matched: false };
  }
  return { confidence: "low", matched: false };
}
