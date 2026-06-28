import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { InterceptedAction } from "@liminal-engine/contracts";
import type { PolicyDecision } from "@liminal-engine/policy";
import { FileProxyHistory, InMemoryProxyHistory } from "./history.ts";

const action: InterceptedAction = {
  id: "ia_history",
  tool: "gh",
  action: "pr-merge",
  target: "PR#20",
  args: { reviews: { approved: 1 } },
  requestedAt: "2026-06-27T20:00:00.000Z",
};

const decision: PolicyDecision = {
  verdict: "ask",
  allowed: false,
  reasons: ["operator approval required"],
  requiredBeforeSend: ["approve or deny"],
  source: "default-deny",
};

test("InMemoryProxyHistory records immutable entries and filters like proxy history", async () => {
  const history = new InMemoryProxyHistory();
  await history.record({
    id: "hist_1",
    action,
    decision,
    mode: "intercept",
    recordedAt: "2026-06-27T20:00:01.000Z",
  });

  const entry = (await history.all())[0]!;
  entry.action.args["reviews"] = { approved: 99 };
  entry.decision.reasons.push("mutated");

  const reread = (await history.byId("hist_1"))!;
  assert.deepEqual(reread.action.args, { reviews: { approved: 1 } });
  assert.deepEqual(reread.decision.reasons, ["operator approval required"]);
  assert.equal((await history.all({ tool: "gh", verdict: "ask", inScopeOnly: true })).length, 1);
  assert.equal((await history.all({ tool: "git" })).length, 0);
});

test("InMemoryProxyHistory records execution outcomes for all matching action entries", async () => {
  const history = new InMemoryProxyHistory();
  await history.record({
    id: "hist_1",
    action,
    decision,
    mode: "intercept",
    recordedAt: "2026-06-27T20:00:01.000Z",
  });
  await history.recordOutcome({
    actionId: action.id,
    exitCode: 0,
    completedAt: "2026-06-27T20:00:02.000Z",
  });

  assert.deepEqual((await history.byId("hist_1"))!.outcome, {
    actionId: action.id,
    exitCode: 0,
    completedAt: "2026-06-27T20:00:02.000Z",
  });
});

test("FileProxyHistory persists entries and outcomes across gateway restarts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liminal-proxy-history-"));
  try {
    const history = new FileProxyHistory(dir);
    await history.record({
      id: "hist_file",
      action,
      decision,
      mode: "intercept",
      recordedAt: "2026-06-27T20:00:01.000Z",
    });

    const restarted = new FileProxyHistory(dir);
    assert.deepEqual((await restarted.all({ tool: "gh" })).map((entry) => entry.id), ["hist_file"]);

    await restarted.recordOutcome({
      actionId: action.id,
      exitCode: 0,
      completedAt: "2026-06-27T20:00:02.000Z",
    });
    assert.deepEqual((await new FileProxyHistory(dir).byId("hist_file"))!.outcome, {
      actionId: action.id,
      exitCode: 0,
      completedAt: "2026-06-27T20:00:02.000Z",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
