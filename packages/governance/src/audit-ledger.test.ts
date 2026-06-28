/**
 * audit-ledger tests — the hash chain is tamper-EVIDENT, not merely
 * tamper-checkable. Each test maps to a LIM-1229 acceptance criterion:
 *   (a) a well-formed chain verifies,
 *   (b) a tampered payload fails the verifier (and points at the break),
 *   (c) a case lifecycle is rebuildable from AuditEvents alone.
 * Plus: append-only writer invariants + reuse of the contract's canonical hash
 * (no bespoke hash), and serves beat #11 / MNC#6 (the "chain valid ✓" surface).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  auditEventContract,
  canonicalHash,
  type AuditEvent,
} from "@liminal-engine/contracts";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import {
  AuditLedger,
  verifyChain,
  reconstructCaseLifecycle,
  AUDIT_EVENT_TYPES,
} from "./audit-ledger.ts";

const CASE = "gc_acme_eu";
const DEAL = "deal_acme";

/** A minimal, deterministic event factory — no Date.now / Math.random. */
function evt(overrides: Partial<AuditEvent>): Omit<AuditEvent, "prevHash"> {
  return {
    id: "ae_x",
    caseId: CASE,
    dealId: DEAL,
    action: "correction-enforced",
    decidingActor: "VP Ops / Head of AI Transformation",
    previousStatus: "on-track",
    newStatus: "at-risk",
    recordedAt: "2026-06-27T10:05:00.000Z",
    ...overrides,
  };
}

test("append writes a genuine hash chain — first prevHash is genesis, each links to the prior eventHash", () => {
  const ledger = new AuditLedger();
  const a = ledger.append(evt({ id: "ae_1" }));
  const b = ledger.append(evt({ id: "ae_2", action: "case.closed" }));

  // genesis: the first event chains off the fixed genesis hash, not undefined.
  assert.equal(a.prevHash, AuditLedger.GENESIS);
  // the second event's prevHash IS the first event's computed eventHash.
  assert.equal(b.prevHash, a.eventHash);
  assert.notEqual(a.eventHash, b.eventHash);
  // eventHash is a 64-char hex sha256 digest.
  assert.match(a.eventHash, /^[0-9a-f]{64}$/);
});

test("eventHash reuses the contract's canonical hash (no bespoke hashing)", () => {
  const ledger = new AuditLedger();
  const a = ledger.append(evt({ id: "ae_1" }));

  // Independently recompute via the contract: prevHash folded into the payload,
  // then the contract's own canonical projection + hash. Must match byte-for-byte.
  const recomputed = canonicalHash(
    auditEventContract.canonical({ ...evt({ id: "ae_1" }), prevHash: AuditLedger.GENESIS }),
  );
  assert.equal(a.eventHash, recomputed);
});

test("append is append-only: the returned chain is frozen and events() is a copy", () => {
  const ledger = new AuditLedger();
  ledger.append(evt({ id: "ae_1" }));
  const snapshot = ledger.events();
  assert.equal(snapshot.length, 1);
  // mutating the returned array must not corrupt the ledger's internal state.
  snapshot.push(snapshot[0]!);
  assert.equal(ledger.events().length, 1);
  // each sealed event is frozen — you cannot retroactively edit a recorded payload.
  assert.equal(Object.isFrozen(snapshot[0]), true);
});

test("(a) a well-formed chain verifies", () => {
  const ledger = new AuditLedger();
  ledger.append(evt({ id: "ae_1", action: "case.opened" }));
  ledger.append(evt({ id: "ae_2", action: "correction-enforced" }));
  ledger.append(evt({ id: "ae_3", action: "case.closed" }));

  const result = verifyChain(ledger.events());
  assert.equal(result.valid, true);
  assert.equal(result.length, 3);
});

test("an empty chain is vacuously valid", () => {
  assert.deepEqual(verifyChain([]), { valid: true, length: 0 });
});

test("(b) a tampered payload fails the verifier and pinpoints the break", () => {
  const ledger = new AuditLedger();
  ledger.append(evt({ id: "ae_1", action: "case.opened" }));
  ledger.append(evt({ id: "ae_2", action: "correction-enforced" }));
  ledger.append(evt({ id: "ae_3", action: "case.closed" }));

  // Attacker mutates a recorded payload AFTER the fact (clone — sealed events are frozen).
  const tampered = ledger.events().map((e) => ({ ...e }));
  tampered[1] = { ...tampered[1]!, newStatus: "on-track" }; // flip a corrected status back

  const result = verifyChain(tampered);
  assert.equal(result.valid, false);
  assert.equal(result.brokenAt, 1, "the break is detected at the tampered event's index");
  assert.match(result.reason ?? "", /hash/i);
});

test("(b') re-linking a broken prevHash is still caught (can't silently splice the chain)", () => {
  const ledger = new AuditLedger();
  ledger.append(evt({ id: "ae_1" }));
  ledger.append(evt({ id: "ae_2" }));
  const events = ledger.events().map((e) => ({ ...e }));
  // Drop the genesis event and present event 2 as the head — its prevHash no
  // longer matches genesis, so the chain head is rejected.
  const spliced = [events[1]!];
  const result = verifyChain(spliced);
  assert.equal(result.valid, false);
  assert.equal(result.brokenAt, 0);
});

test("(c) a case lifecycle is rebuildable from AuditEvents alone", () => {
  const ledger = new AuditLedger();
  ledger.append(
    evt({
      id: "ae_open",
      action: "case.opened",
      previousStatus: "on-track",
      newStatus: "on-track",
      beforeState: { status: "none" },
      afterState: { status: "open", missedRequirement: "EU data residency" },
    }),
  );
  ledger.append(
    evt({
      id: "ae_enforced",
      action: "correction-enforced",
      previousStatus: "on-track",
      newStatus: "at-risk",
      afterState: { status: "corrected", dealStatus: "at-risk" },
    }),
  );
  ledger.append(
    evt({
      id: "ae_closed",
      action: "case.closed",
      previousStatus: "at-risk",
      newStatus: "at-risk",
      afterState: { status: "closed" },
    }),
  );

  const rebuilt = reconstructCaseLifecycle(ledger.events(), CASE);

  // Rebuilt purely from events — no external case store consulted.
  assert.equal(rebuilt.caseId, CASE);
  assert.equal(rebuilt.dealId, DEAL);
  assert.equal(rebuilt.currentStatus, "closed");
  assert.equal(rebuilt.dealStatus, "at-risk");
  assert.deepEqual(
    rebuilt.timeline.map((e) => e.action),
    ["case.opened", "correction-enforced", "case.closed"],
  );
  // the chain backing the reconstruction is itself verified.
  assert.equal(rebuilt.chainValid, true);
});

test("reconstruct only folds the requested case; events for other cases are ignored", () => {
  const ledger = new AuditLedger();
  ledger.append(evt({ id: "ae_1", caseId: "gc_other", action: "case.opened" }));
  ledger.append(evt({ id: "ae_2", caseId: CASE, action: "case.opened" }));
  ledger.append(evt({ id: "ae_3", caseId: CASE, action: "case.closed" }));

  const rebuilt = reconstructCaseLifecycle(ledger.events(), CASE);
  assert.equal(rebuilt.timeline.length, 2);
  assert.deepEqual(rebuilt.timeline.map((e) => e.id), ["ae_2", "ae_3"]);
});

test("reconstruct refuses to rebuild from a tampered chain (integrity precedes interpretation)", () => {
  const ledger = new AuditLedger();
  ledger.append(evt({ id: "ae_1", action: "case.opened" }));
  ledger.append(evt({ id: "ae_2", action: "case.closed" }));
  const tampered = ledger.events().map((e) => ({ ...e }));
  tampered[0] = { ...tampered[0]!, action: "case.opened", decidingActor: "tampered" };

  assert.throws(() => reconstructCaseLifecycle(tampered, CASE), /chain/i);
});

test("AUDIT_EVENT_TYPES is a named vocabulary covering the lifecycle beats", () => {
  // IDEAS.md line 51 — a named event-type enum to assert against.
  for (const t of ["case.opened", "correction.enforced", "gate.evaluated", "eval.generated", "case.closed"]) {
    assert.ok(AUDIT_EVENT_TYPES.includes(t as (typeof AUDIT_EVENT_TYPES)[number]), `${t} in vocabulary`);
  }
});

test("the locked Acme AuditEvent fixture appends and verifies (beat #11 / MNC#6 surface)", () => {
  const ledger = new AuditLedger();
  // strip prevHash if the fixture omits it; the ledger assigns the chain link.
  const { prevHash, ...payload } = acmeScenario.auditEvent;
  void prevHash;
  const sealed = ledger.append(payload);
  assert.equal(sealed.caseId, acmeScenario.auditEvent.caseId);
  assert.equal(verifyChain(ledger.events()).valid, true);
});
