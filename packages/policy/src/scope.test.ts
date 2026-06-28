import { test } from "node:test";
import assert from "node:assert/strict";
import type { InterceptedAction } from "@liminal-engine/contracts";
import { evaluateScope } from "./scope.ts";

const action: InterceptedAction = {
  id: "ia_scope",
  tool: "gh",
  action: "pr-merge",
  target: "PR#20",
  args: {},
  requestedAt: "2026-06-27T20:00:00.000Z",
};

test("evaluateScope includes matching tool/action/target traffic", () => {
  assert.deepEqual(
    evaluateScope(action, {
      include: [{ id: "merge-prs", tool: "gh", action: "pr-merge", targetPattern: "PR#*" }],
    }),
    {
      inScope: true,
      matchedIncludeId: "merge-prs",
      reason: "Action matched included scope merge-prs.",
    },
  );
});

test("evaluateScope excludes explicit target exclusions before includes", () => {
  const result = evaluateScope(action, {
    include: [{ id: "all-gh", tool: "gh", action: "*" }],
    exclude: [{ id: "pr20", tool: "gh", action: "pr-merge", targetPattern: "PR#20" }],
  });

  assert.equal(result.inScope, false);
  assert.equal(result.matchedExcludeId, "pr20");
});

test("evaluateScope treats unmatched include scope as out of scope", () => {
  const result = evaluateScope(action, {
    include: [{ id: "force-push", tool: "git", action: "push" }],
  });

  assert.equal(result.inScope, false);
  assert.match(result.reason, /did not match/);
});
