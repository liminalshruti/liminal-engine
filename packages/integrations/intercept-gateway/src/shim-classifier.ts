import type { InterceptedAction } from "@liminal-engine/contracts";

export type ShimTool = "gh" | "git" | "deploy";

export interface ClassifiedCommand {
  tool: ShimTool;
  action: string;
  target?: string;
  args: Record<string, unknown>;
}

export function classifyCommand(tool: ShimTool, args: readonly string[]): ClassifiedCommand | null {
  if (tool === "gh") return classifyGh(args);
  if (tool === "git") return classifyGit(args);
  return classifyDeploy(args);
}

export function toInterceptedAction(
  id: string,
  requestedAt: string,
  command: ClassifiedCommand,
  provenance: Partial<Pick<InterceptedAction, "agentId" | "sessionId" | "goalId" | "lane">> = {},
): InterceptedAction {
  return {
    id,
    tool: command.tool,
    action: command.action,
    ...(command.target !== undefined ? { target: command.target } : {}),
    args: command.args,
    ...provenance,
    requestedAt,
  };
}

function classifyGh(args: readonly string[]): ClassifiedCommand | null {
  const [group, command] = args;
  if (group === "pr" && command === "merge") {
    const pr = args.find((arg, index) => index > 1 && !arg.startsWith("-"));
    return {
      tool: "gh",
      action: "pr-merge",
      ...(pr !== undefined ? { target: pr.startsWith("PR#") ? pr : `PR#${pr}` } : {}),
      args: { argv: [...args] },
    };
  }

  if (group === "repo" && command === "fork") {
    const repo = args.find((arg, index) => index > 1 && !arg.startsWith("-"));
    return {
      tool: "gh",
      action: "repo-fork",
      ...(repo !== undefined ? { target: repo } : {}),
      args: { argv: [...args] },
    };
  }

  if (group === "repo" && command === "edit" && args.includes("--visibility")) {
    const visibilityIndex = args.indexOf("--visibility");
    const visibility = visibilityIndex >= 0 ? args[visibilityIndex + 1] : undefined;
    return {
      tool: "gh",
      action: "repo-edit-visibility",
      args: {
        argv: [...args],
        repo: { visibility },
      },
    };
  }

  return null;
}

function classifyGit(args: readonly string[]): ClassifiedCommand | null {
  const [command] = args;
  if (command !== "push") return null;
  const force = args.includes("--force") || args.includes("-f") || args.includes("--force-with-lease");
  if (!force) return null;

  const nonFlags = args.slice(1).filter((arg) => !arg.startsWith("-"));
  return {
    tool: "git",
    action: "push",
    ...(nonFlags.length > 0 ? { target: nonFlags.join(" ") } : {}),
    args: {
      argv: [...args],
      force: true,
      forceWithLease: args.includes("--force-with-lease"),
    },
  };
}

function classifyDeploy(args: readonly string[]): ClassifiedCommand | null {
  if (args.length === 0) return null;
  const environmentFlag = args.findIndex((arg) => arg === "--environment" || arg === "--env");
  const environment = environmentFlag >= 0 ? args[environmentFlag + 1] : undefined;
  return {
    tool: "deploy",
    action: "deploy",
    ...(environment !== undefined ? { target: environment } : {}),
    args: {
      argv: [...args],
      deploy: { environment },
    },
  };
}
