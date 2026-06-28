import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { InterceptedAction, ActionPolicyRule } from "@liminal-engine/contracts";
import {
  FileInterceptQueue,
  FilePolicyStore,
  InMemoryInterceptQueue,
  InMemoryPolicyStore,
} from "./index.ts";

const rule: ActionPolicyRule = {
  id: "prule_store",
  version: 1,
  fromCorrectionId: "ce_store",
  evalCaseId: "ec_store",
  scope: { tool: "gh", action: "pr-merge" },
  effect: {
    verdict: "ask",
    actionType: "require_approval",
    reasons: ["Ask before merging."],
    requiredBefore: ["Receive approval."],
  },
  status: "proposed",
  createdAt: "2026-06-27T20:00:00.000Z",
};

test("InMemoryPolicyStore stores, activates, and lists rules deterministically", async () => {
  const store = new InMemoryPolicyStore();
  await store.putRule(rule);
  assert.deepEqual(await store.activeRules(), []);

  const active = { ...rule, status: "active" as const };
  await store.updateRule(active);
  assert.deepEqual(await store.byId(rule.id), active);
  assert.deepEqual(await store.activeRules(), [active]);
});

test("InMemoryPolicyStore rejects duplicate inserts", async () => {
  const store = new InMemoryPolicyStore();
  await store.putRule(rule);
  await assert.rejects(() => store.putRule(rule), /already exists/);
});

test("InMemoryInterceptQueue orders pending actions by enqueue time", async () => {
  const queue = new InMemoryInterceptQueue();
  const action: InterceptedAction = {
    id: "ia_queue",
    tool: "gh",
    action: "pr-merge",
    args: {},
    requestedAt: "2026-06-27T20:00:00.000Z",
  };
  await queue.enqueue({ id: "q2", action: { ...action, id: "ia_queue_2" }, enqueuedAt: "2026-06-27T20:02:00.000Z" });
  await queue.enqueue({ id: "q1", action, enqueuedAt: "2026-06-27T20:01:00.000Z" });
  assert.deepEqual((await queue.pending()).map((item) => item.id), ["q1", "q2"]);
  assert.equal((await queue.remove("q1"))?.id, "q1");
  assert.deepEqual((await queue.pending()).map((item) => item.id), ["q2"]);
});

test("FilePolicyStore persists learned rules across adapter restarts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liminal-policy-store-"));
  try {
    const store = new FilePolicyStore(dir);
    await store.putRule(rule);
    await store.updateRule({ ...rule, status: "active" });

    const restarted = new FilePolicyStore(dir);
    assert.deepEqual(await restarted.activeRules(), [{ ...rule, status: "active" }]);
    await assert.rejects(() => restarted.putRule(rule), /already exists/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("FileInterceptQueue persists pending intercepts and removes them durably", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liminal-intercept-queue-"));
  try {
    const action: InterceptedAction = {
      id: "ia_file_queue",
      tool: "gh",
      action: "pr-merge",
      args: {},
      requestedAt: "2026-06-27T20:00:00.000Z",
    };
    const queue = new FileInterceptQueue(dir);
    await queue.enqueue({ id: "q_file", action, enqueuedAt: "2026-06-27T20:01:00.000Z" });

    const restarted = new FileInterceptQueue(dir);
    assert.deepEqual((await restarted.pending()).map((item) => item.id), ["q_file"]);
    assert.equal((await restarted.remove("q_file"))?.action.id, action.id);
    assert.deepEqual(await new FileInterceptQueue(dir).pending(), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
