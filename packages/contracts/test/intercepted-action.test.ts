import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INTERCEPTED_ACTION_SCHEMA,
  interceptedActionContract,
} from "../src/intercepted-action.contract.ts";

const validFull = {
  id: "ia_pr20_merge",
  tool: "gh",
  action: "pr-merge",
  target: "PR#20",
  args: { reviews: { approved: 1, rejected: 1 } },
  agentId: "claude-implementer",
  sessionId: "sess_pr20_replay",
  goalId: "LIM-1266",
  lane: "shayaun-main",
  requestedAt: "2026-06-27T10:00:00.000Z",
};

const validMinimal = {
  id: "ia_git_force_push",
  tool: "git",
  action: "push",
  args: { force: true, ref: "main" },
  requestedAt: "2026-06-27T10:01:00.000Z",
};

test("InterceptedAction parses a fully-populated action and round-trips", () => {
  assert.deepEqual(interceptedActionContract.parse(validFull), validFull);
});

test("InterceptedAction parses a minimal action — target and provenance are optional", () => {
  assert.deepEqual(interceptedActionContract.parse(validMinimal), validMinimal);
});

test("canonical projection snake_cases keys and omits absent optionals", () => {
  const full = interceptedActionContract.canonical(validFull) as Record<string, unknown>;
  assert.equal(full.schema, INTERCEPTED_ACTION_SCHEMA);
  assert.equal(full.target, "PR#20");
  assert.equal(full.agent_id, "claude-implementer");
  assert.equal(full.session_id, "sess_pr20_replay");
  assert.equal(full.goal_id, "LIM-1266");
  assert.equal(full.lane, "shayaun-main");
  assert.equal(full.requested_at, "2026-06-27T10:00:00.000Z");
  assert.deepEqual(full.args, { reviews: { approved: 1, rejected: 1 } });
  // camelCase keys never leak into the canonical projection
  assert.ok(!("agentId" in full));
  assert.ok(!("requestedAt" in full));

  const minimal = interceptedActionContract.canonical(validMinimal) as Record<string, unknown>;
  // absent optionals are projected as MISSING keys (not null/undefined) so the hash is stable
  for (const k of ["target", "agent_id", "session_id", "goal_id", "lane"]) {
    assert.ok(!(k in minimal), `expected canonical to omit absent optional "${k}"`);
  }
  assert.deepEqual(minimal.args, { force: true, ref: "main" });
});

test("args is validated as a record", () => {
  // a record value is required
  assert.equal(interceptedActionContract.safeParse({ ...validMinimal, args: "nope" }).success, false);
  assert.equal(interceptedActionContract.safeParse({ ...validMinimal, args: 42 }).success, false);
  const { args: _omit, ...noArgs } = validMinimal;
  assert.equal(interceptedActionContract.safeParse(noArgs).success, false);
  // an empty record is a valid (arg-less) action
  assert.equal(interceptedActionContract.safeParse({ ...validMinimal, args: {} }).success, true);
});

test("requestedAt must be an ISO datetime", () => {
  assert.equal(interceptedActionContract.safeParse({ ...validMinimal, requestedAt: "not-a-date" }).success, false);
  const { requestedAt: _omit, ...noTs } = validMinimal;
  assert.equal(interceptedActionContract.safeParse(noTs).success, false);
});

test("core action fields are required and non-empty", () => {
  for (const field of ["id", "tool", "action"] as const) {
    const { [field]: _omit, ...missing } = validMinimal;
    assert.equal(interceptedActionContract.safeParse(missing).success, false, `missing ${field} should reject`);
    assert.equal(
      interceptedActionContract.safeParse({ ...validMinimal, [field]: "" }).success,
      false,
      `empty ${field} should reject`,
    );
  }
});

test("provenance fields are optional but typed (wrong type rejected)", () => {
  assert.equal(interceptedActionContract.safeParse({ ...validMinimal, agentId: 123 }).success, false);
  assert.equal(interceptedActionContract.safeParse({ ...validMinimal, lane: 5 }).success, false);
  assert.equal(interceptedActionContract.safeParse({ ...validMinimal, sessionId: "" }).success, false);
});

test("hash is deterministic and content-addressed", () => {
  const h = interceptedActionContract.hash(validFull);
  assert.match(h, /^[0-9a-f]{64}$/);
  // structurally-equal inputs hash identically (key order independent)
  assert.equal(interceptedActionContract.hash({ ...validFull }), h);
  // a material change to args changes the hash
  const flipped = { ...validFull, args: { reviews: { approved: 2, rejected: 0 } } };
  assert.notEqual(interceptedActionContract.hash(flipped), h);
});
