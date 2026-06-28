/**
 * InMemoryRequirementStore tests (LIM-1322) — the RequirementStore port + its
 * in-memory adapter. Covers every acceptance criterion:
 *   - each lifecycle transition: create→proposed, approve→active, reject→rejected,
 *     retire→retired (and the illegal transitions);
 *   - active queries by deal / goal / scope EXCLUDE proposed/rejected/retired;
 *   - version updates APPEND new records and never mutate historical approved
 *     payloads (immutable history);
 *   - store errors are REPRESENTABLE (Result, never thrown) so a gate can fail
 *     CLOSED on store failure (`failClosed`);
 *   - determinism via an injected, seeded Clock/IdGen.
 *
 * Tests are exempt from the boundary lint, so they may import the in-memory
 * adapter directly and a deterministic Clock/IdGen (defined inline here — the
 * Acme fixture generators yield a fixed short sequence, unsuited to bulk creates).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { requirementContract } from "@liminal-engine/contracts";
import type { Requirement } from "@liminal-engine/contracts";
import { failClosed } from "@liminal-engine/governance";
import type {
  Clock,
  IdGen,
  RequirementDraft,
  RequirementStore,
  RequirementStoreError,
  Result,
} from "@liminal-engine/governance";
import { InMemoryRequirementStore } from "./index.ts";

// — deterministic, seedable Clock + IdGen (mirrors the repo's injection seam) ————

/** Sequential id generator: `req_1`, `req_2`, … (seed = the starting counter). */
function seqIdGen(prefix = "req_"): IdGen {
  let n = 0;
  return { next: () => `${prefix}${++n}` };
}

/** Clock that steps a fixed interval each call, yielding valid ISO timestamps. */
function steppingClock(startMs = Date.UTC(2026, 5, 27, 9, 0, 0), stepMs = 60_000): Clock {
  let t = startMs;
  return {
    now: () => {
      const iso = new Date(t).toISOString();
      t += stepMs;
      return iso;
    },
  };
}

function freshStore(): InMemoryRequirementStore {
  return new InMemoryRequirementStore(steppingClock(), seqIdGen());
}

function draft(overrides: Partial<RequirementDraft> = {}): RequirementDraft {
  return {
    goalId: "goal_acme_expansion",
    dealId: "deal_acme",
    text: "All Acme EU customer data must remain resident in EU data centers.",
    ownerRole: "Security",
    severity: "hard",
    scope: ["deal-proposal", "launch-plan"],
    createdBy: "operator",
    evidenceRefs: ["call_acme_kickoff"],
    ...overrides,
  };
}

function unwrap<T>(result: Result<T>): T {
  assert.equal(result.ok, true, `expected ok, got ${JSON.stringify(result)}`);
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}

function expectErr<T>(result: Result<T>): RequirementStoreError {
  assert.equal(result.ok, false, `expected error, got ${JSON.stringify(result)}`);
  if (result.ok) throw new Error("unreachable");
  return result.error;
}

// — lifecycle transitions ———————————————————————————————————————————————————

test("LIM-1322: create → proposed (store-assigned id + createdAt, no approval yet)", async () => {
  const store = freshStore();

  const created = unwrap(await store.create(draft()));

  assert.equal(created.status, "proposed");
  assert.equal(created.id, "req_1"); // assigned by the injected IdGen
  assert.equal(created.createdAt, "2026-06-27T09:00:00.000Z"); // from the injected Clock
  assert.equal(created.approvedBy, undefined);
  assert.equal(created.activatedAt, undefined);
  // the created record is a valid Requirement per the merged contract
  assert.equal(requirementContract.safeParse(created).success, true);
});

test("LIM-1322: approve → active (sets approvedBy + activatedAt; proposed required)", async () => {
  const store = freshStore();
  const { id } = unwrap(await store.create(draft()));

  const approved = unwrap(await store.approve(id, "VP Ops / Head of AI Transformation"));

  assert.equal(approved.status, "active");
  assert.equal(approved.approvedBy, "VP Ops / Head of AI Transformation");
  assert.equal(approved.activatedAt, "2026-06-27T09:01:00.000Z"); // 2nd clock tick
  assert.equal(unwrap(await store.get(id)).status, "active");
});

test("LIM-1322: reject → rejected (proposed required)", async () => {
  const store = freshStore();
  const { id } = unwrap(await store.create(draft()));

  assert.equal(unwrap(await store.reject(id)).status, "rejected");
  assert.equal(unwrap(await store.get(id)).status, "rejected");
});

test("LIM-1322: retire → retired (active required)", async () => {
  const store = freshStore();
  const { id } = unwrap(await store.create(draft()));
  await store.approve(id, "Security");

  assert.equal(unwrap(await store.retire(id)).status, "retired");
  assert.equal(unwrap(await store.get(id)).status, "retired");
});

test("LIM-1322: illegal transitions are representable invalid_transition errors (never thrown)", async () => {
  const store = freshStore();
  const { id } = unwrap(await store.create(draft()));

  // retire/ a proposed (must be active) → invalid_transition
  const cannotRetire = expectErr(await store.retire(id));
  assert.equal(cannotRetire.code, "invalid_transition");
  assert.equal(cannotRetire.from, "proposed");
  assert.equal(cannotRetire.to, "retired");

  await store.approve(id, "Security"); // → active

  // approve an already-active → invalid_transition
  assert.equal(expectErr(await store.approve(id, "Security")).code, "invalid_transition");
  // reject an active (only proposed may be rejected) → invalid_transition
  assert.equal(expectErr(await store.reject(id)).code, "invalid_transition");

  await store.retire(id); // → retired (terminal)

  // nothing transitions out of a terminal state
  assert.equal(expectErr(await store.approve(id, "Security")).code, "invalid_transition");
  assert.equal(expectErr(await store.retire(id)).code, "invalid_transition");
  assert.equal(expectErr(await store.amend(id, { text: "changed" })).code, "invalid_transition");
});

test("LIM-1322: operating on an unknown id is a representable not_found error", async () => {
  const store = freshStore();

  const results: Result<unknown>[] = [
    await store.approve("nope", "Security"),
    await store.reject("nope"),
    await store.retire("nope"),
    await store.amend("nope", { text: "x" }),
    await store.get("nope"),
    await store.history("nope"),
  ];
  for (const result of results) {
    const error = expectErr(result);
    assert.equal(error.code, "not_found");
    assert.equal(error.id, "nope");
  }
});

// — active queries exclude non-active requirements —————————————————————————————

test("LIM-1322: activeByDeal / activeByGoal exclude proposed, rejected AND retired", async () => {
  const store = freshStore();

  const proposed = unwrap(await store.create(draft()));
  const active = unwrap(await store.create(draft()));
  await store.approve(active.id, "Security");
  const rejected = unwrap(await store.create(draft()));
  await store.reject(rejected.id);
  const retired = unwrap(await store.create(draft()));
  await store.approve(retired.id, "Security");
  await store.retire(retired.id);

  const byDeal = unwrap(await store.activeByDeal("deal_acme"));
  assert.deepEqual(
    byDeal.map((r) => r.id),
    [active.id],
    "only the approved-and-still-active requirement governs the deal",
  );
  // the excluded ones are genuinely absent (not merely re-ordered away)
  for (const r of byDeal) assert.equal(r.status, "active");
  assert.equal(byDeal.some((r) => r.id === proposed.id), false);

  const byGoal = unwrap(await store.activeByGoal("goal_acme_expansion"));
  assert.deepEqual(byGoal.map((r) => r.id), [active.id]);

  // a different deal/goal sees nothing active
  assert.deepEqual(unwrap(await store.activeByDeal("deal_other")), []);
  assert.deepEqual(unwrap(await store.activeByGoal("goal_other")), []);
});

test("LIM-1322: activeByScope returns active requirements governing an action/output surface", async () => {
  const store = freshStore();

  const proposal = unwrap(await store.create(draft({ scope: ["deal-proposal", "launch-plan"] })));
  await store.approve(proposal.id, "Security");
  const owners = unwrap(await store.create(draft({ scope: ["owner-assignment"] })));
  await store.approve(owners.id, "Security");
  // a proposed candidate that also scopes launch-plan — must NOT surface as active
  const proposedLaunch = unwrap(await store.create(draft({ scope: ["launch-plan"] })));

  assert.deepEqual(
    unwrap(await store.activeByScope("launch-plan")).map((r) => r.id),
    [proposal.id],
    "only the ACTIVE launch-plan requirement is returned; the proposed one is excluded",
  );
  assert.deepEqual(unwrap(await store.activeByScope("owner-assignment")).map((r) => r.id), [owners.id]);
  assert.deepEqual(unwrap(await store.activeByScope("deal-proposal")).map((r) => r.id), [proposal.id]);
  assert.deepEqual(unwrap(await store.activeByScope("nonexistent-surface")), []);
  assert.equal(proposedLaunch.status, "proposed");
});

// — version updates append; immutable history ————————————————————————————————

test("LIM-1322: amend APPENDS a new version and never mutates the historical approved payload", async () => {
  const store = freshStore();
  const { id } = unwrap(await store.create(draft({ scope: ["launch-plan"] })));
  const approved = unwrap(await store.approve(id, "Security"));

  // snapshot the approved payload (content + canonical hash) BEFORE the amend
  const approvedClone: Requirement = structuredClone(approved);
  const approvedHashBefore = requirementContract.hash(approved);

  const amended = unwrap(
    await store.amend(id, { scope: ["launch-plan", "owner-assignment"], text: "Expanded EU residency scope." }),
  );

  // the amendment is a NEW record reflecting the change…
  assert.deepEqual(amended.scope, ["launch-plan", "owner-assignment"]);
  assert.equal(amended.text, "Expanded EU residency scope.");
  assert.equal(amended.status, "active"); // lifecycle carries forward
  assert.equal(amended.approvedBy, "Security");

  // …the prior approved version is still in history, byte-for-byte UNCHANGED
  const versions = unwrap(await store.history(id));
  assert.equal(versions.length, 3, "proposed → active → amended (append-only)");
  assert.deepEqual(versions.map((v) => v.status), ["proposed", "active", "active"]);
  const historicalApproved = versions[1]!;
  assert.deepEqual(historicalApproved, approvedClone, "historical approved payload not mutated");
  assert.equal(requirementContract.hash(historicalApproved), approvedHashBefore);

  // the historical snapshot is frozen — an in-place mutation attempt throws
  assert.throws(() => {
    (historicalApproved.scope as string[]).push("tampered");
  });
  assert.throws(() => {
    (historicalApproved as { text: string }).text = "tampered";
  });

  // the current view is the amended version; only one current record per id is active
  assert.equal(unwrap(await store.get(id)).text, "Expanded EU residency scope.");
  assert.deepEqual(unwrap(await store.activeByDeal("deal_acme")).map((r) => r.id), [id]);
  assert.deepEqual(unwrap(await store.activeByScope("owner-assignment")).map((r) => r.id), [id]);
});

test("LIM-1322: returned query arrays + history are isolated from the internal log", async () => {
  const store = freshStore();
  const { id } = unwrap(await store.create(draft()));
  await store.approve(id, "Security");

  const active = unwrap(await store.activeByDeal("deal_acme")) as Requirement[];
  active.length = 0; // mutate the RETURNED array
  // the store is unaffected — it handed back a fresh array, not its internal state
  assert.equal(unwrap(await store.activeByDeal("deal_acme")).length, 1);
});

// — representable errors / fail-closed ————————————————————————————————————————

test("LIM-1322: invalid input is a representable validation error — not thrown, not stored", async () => {
  const store = freshStore();

  // empty text violates the contract (min length 1) → validation Result, no throw
  const error = expectErr(await store.create(draft({ text: "" })));
  assert.equal(error.code, "validation");
  // nothing was appended — the malformed record never entered history
  assert.equal(expectErr(await store.get("req_1")).code, "not_found");

  // empty approver also violates the contract (active requires approvedBy min length 1)
  const good = unwrap(await store.create(draft()));
  assert.equal(expectErr(await store.approve(good.id, "")).code, "validation");
  // the failed approval did not advance the lifecycle
  assert.equal(unwrap(await store.get(good.id)).status, "proposed");
});

test("LIM-1322: a duplicate generated id is a representable duplicate error", async () => {
  // an IdGen that (mis)yields the same id twice — the store refuses the collision
  const collidingIds: IdGen = { next: () => "req_dup" };
  const store = new InMemoryRequirementStore(steppingClock(), collidingIds);

  assert.equal(unwrap(await store.create(draft())).id, "req_dup");
  assert.equal(expectErr(await store.create(draft())).code, "duplicate");
});

test("LIM-1322: the adapter NEVER throws — an internal fault becomes a store_unavailable Result", async () => {
  // a Clock that throws mid-operation simulates a backing dependency failing
  const faultyClock: Clock = {
    now: () => {
      throw new Error("clock backend unavailable");
    },
  };
  const store = new InMemoryRequirementStore(faultyClock, seqIdGen());

  // create() consumes the clock → the throw is caught and represented, not propagated
  const result = await store.create(draft());
  const error = expectErr(result);
  assert.equal(error.code, "store_unavailable");
  assert.match(error.message, /clock backend unavailable/);
});

test("LIM-1322: store errors are representable so a gate FAILS CLOSED on store failure", async () => {
  // (1) failClosed proceeds on success…
  const store = freshStore();
  const { id } = unwrap(await store.create(draft()));
  await store.approve(id, "Security");
  const okRead = failClosed(await store.activeByScope("launch-plan"));
  assert.equal(okRead.proceed, true);
  if (okRead.proceed) assert.equal(okRead.value.length, 1);

  // …and fails closed on a real adapter error (not_found read)
  const missingRead = failClosed(await store.get("does-not-exist"));
  assert.equal(missingRead.proceed, false);

  // (2) a gate that consults the store DENIES when the store query reports failure.
  // An unavailable store stands in for a backing-store outage on the query path.
  const gateAllows = async (s: RequirementStore, surface: string): Promise<boolean> => {
    const read = failClosed(await s.activeByScope(surface));
    return read.proceed; // cannot confirm the active governance set ⇒ deny (fail closed)
  };

  assert.equal(await gateAllows(store, "launch-plan"), true, "healthy store ⇒ gate proceeds");
  assert.equal(
    await gateAllows(unavailableStore(), "launch-plan"),
    false,
    "store failure ⇒ gate fails CLOSED",
  );
});

// — determinism ———————————————————————————————————————————————————————————————

test("LIM-1322: deterministic — same ops under a fresh seeded Clock/IdGen produce identical records", async () => {
  const run = async (): Promise<Requirement> => {
    const store = new InMemoryRequirementStore(steppingClock(), seqIdGen());
    const { id } = unwrap(await store.create(draft()));
    return unwrap(await store.approve(id, "Security"));
  };

  const first = await run();
  const second = await run();

  assert.deepEqual(first, second);
  assert.equal(requirementContract.hash(first), requirementContract.hash(second));
});

// — port conformance (type-level) —————————————————————————————————————————————

test("LIM-1322: the adapter conforms to the RequirementStore port", () => {
  const store: RequirementStore = freshStore();
  assert.ok(store);
});

// A store whose every operation reports a backing-store outage — used to drive a
// consumer's fail-closed branch (a query failing on the read path).
function unavailableStore(): RequirementStore {
  const fail = async (): Promise<Result<never>> => ({
    ok: false,
    error: { code: "store_unavailable", message: "backing store down" },
  });
  return {
    create: fail,
    approve: fail,
    reject: fail,
    retire: fail,
    amend: fail,
    get: fail,
    history: fail,
    activeByDeal: fail,
    activeByGoal: fail,
    activeByScope: fail,
  };
}
