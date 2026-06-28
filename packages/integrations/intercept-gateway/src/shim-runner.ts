import { spawn } from "node:child_process";
import { classifyCommand, toInterceptedAction, type ShimTool } from "./shim-classifier.ts";

export async function runShim(tool: ShimTool, argv: readonly string[]): Promise<number> {
  const command = classifyCommand(tool, argv);
  if (command === null) return runReal(tool, argv);

  const gatewayUrl = process.env["LIMINAL_POLICY_GATEWAY_URL"] ?? "http://127.0.0.1:17373/intercept";
  const actionId = process.env["LIMINAL_ACTION_ID"];
  const requestedAt = process.env["LIMINAL_REQUESTED_AT"];
  if (actionId === undefined || actionId.length === 0 || requestedAt === undefined || requestedAt.length === 0) {
    process.stderr.write(
      "policy shim failed closed: LIMINAL_ACTION_ID and LIMINAL_REQUESTED_AT must be injected for consequential actions\n",
    );
    return 2;
  }

  const action = toInterceptedAction(
    actionId,
    requestedAt,
    command,
    {
      agentId: process.env["LIMINAL_AGENT_ID"],
      sessionId: process.env["LIMINAL_SESSION_ID"],
      goalId: process.env["LIMINAL_GOAL_ID"],
      lane: process.env["LIMINAL_LANE"],
    },
  );

  try {
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action),
    });
    if (!response.ok) {
      process.stderr.write(`policy gateway failed closed: HTTP ${response.status}\n`);
      return 2;
    }
    const decision = await response.json() as { allowed?: boolean; verdict?: string; reasons?: string[] };
    if (decision.allowed !== true) {
      process.stderr.write(`policy gateway held ${tool} ${argv.join(" ")}: ${(decision.reasons ?? []).join("; ")}\n`);
      return 2;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    process.stderr.write(`policy gateway unreachable; failed closed: ${detail}\n`);
    return 2;
  }

  const exitCode = await runReal(tool, argv);
  await postOutcome(gatewayUrl, {
    actionId,
    exitCode,
    completedAt: process.env["LIMINAL_COMPLETED_AT"] ?? new Date().toISOString(),
  });
  return exitCode;
}

function runReal(tool: ShimTool, argv: readonly string[]): Promise<number> {
  const envName = `LIMINAL_REAL_${tool.toUpperCase()}`;
  const real = process.env[envName];
  if (real === undefined || real.length === 0) {
    process.stderr.write(`${envName} must point at the real ${tool} binary when using the PATH shim\n`);
    return Promise.resolve(127);
  }

  return new Promise((resolve) => {
    const child = spawn(real, [...argv], { stdio: "inherit", env: process.env });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (error) => {
      process.stderr.write(`failed to exec ${real}: ${error.message}\n`);
      resolve(127);
    });
  });
}

async function postOutcome(
  interceptUrl: string,
  outcome: { actionId: string; exitCode: number; completedAt: string },
): Promise<void> {
  try {
    const url = new URL(interceptUrl);
    url.pathname = "/outcome";
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(outcome),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    process.stderr.write(`policy gateway outcome recording failed: ${detail}\n`);
  }
}
