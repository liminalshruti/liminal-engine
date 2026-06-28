import { test } from "node:test";
import assert from "node:assert/strict";
import { interceptedActionFromMcpCall, isDestructiveMcpTool } from "./mcp-classifier.ts";

test("isDestructiveMcpTool recognizes write/destructive MCP tool names", () => {
  assert.equal(isDestructiveMcpTool("merge_pull_request"), true);
  assert.equal(isDestructiveMcpTool("delete_issue"), true);
  assert.equal(isDestructiveMcpTool("send_message"), true);
  assert.equal(isDestructiveMcpTool("search_messages"), false);
  assert.equal(isDestructiveMcpTool("read_issue"), false);
});

test("interceptedActionFromMcpCall maps destructive MCP calls onto the same control-plane action contract", () => {
  assert.deepEqual(
    interceptedActionFromMcpCall(
      "ia_mcp_merge",
      "2026-06-27T20:00:00.000Z",
      {
        serverName: "github",
        toolName: "merge_pull_request",
        args: { pullRequestId: "PR#20", method: "squash" },
      },
      { goalId: "goal_policy_loop" },
    ),
    {
      id: "ia_mcp_merge",
      tool: "mcp:github",
      action: "merge_pull_request",
      target: "PR#20",
      args: { pullRequestId: "PR#20", method: "squash" },
      goalId: "goal_policy_loop",
      requestedAt: "2026-06-27T20:00:00.000Z",
    },
  );
});

test("interceptedActionFromMcpCall ignores read-only MCP calls", () => {
  assert.equal(
    interceptedActionFromMcpCall(
      "ia_mcp_read",
      "2026-06-27T20:00:00.000Z",
      { serverName: "linear", toolName: "read_issue", args: { issueId: "LIM-1" } },
    ),
    null,
  );
});
