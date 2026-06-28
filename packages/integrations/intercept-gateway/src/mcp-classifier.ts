import type { InterceptedAction } from "@liminal-engine/contracts";

export interface McpToolCall {
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
}

const DESTRUCTIVE_MCP_PATTERNS = [
  /(^|_)(delete|remove|trash|archive|destroy)($|_)/,
  /(^|_)(send|post|publish|create|update|patch|move|transition|label)($|_)/,
  /(^|_)(merge|close|cancel|deploy|invite|share)($|_)/,
] as const;

export function interceptedActionFromMcpCall(
  id: string,
  requestedAt: string,
  call: McpToolCall,
  provenance: Partial<Pick<InterceptedAction, "agentId" | "sessionId" | "goalId" | "lane">> = {},
): InterceptedAction | null {
  if (!isDestructiveMcpTool(call.toolName)) return null;
  return {
    id,
    tool: `mcp:${call.serverName}`,
    action: call.toolName,
    ...(targetFromArgs(call.args) !== undefined ? { target: targetFromArgs(call.args) } : {}),
    args: call.args,
    ...provenance,
    requestedAt,
  };
}

export function isDestructiveMcpTool(toolName: string): boolean {
  const normalized = toolName.trim().toLowerCase();
  return DESTRUCTIVE_MCP_PATTERNS.some((pattern) => pattern.test(normalized));
}

function targetFromArgs(args: Record<string, unknown>): string | undefined {
  for (const key of ["id", "issueId", "pullRequestId", "threadId", "channelId", "resourceId"]) {
    const value = args[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}
