/**
 * audit-redaction tests (LIM-1248) — the audit path stores sensitive data by
 * reference, never raw, WITHOUT breaking the hash chain or reconstruction.
 *
 * Proves the issue's acceptance directly:
 *   - the audit-ledger WRITER redacts sensitive snapshot fields at the boundary, so
 *     a raw sensitive value can never be sealed into the chain;
 *   - the redacted reference is the existing canonical hash (verifiable, not raw);
 *   - the hash chain still verifies and BOTH reconstructors still rebuild the case
 *     lifecycle from the (redacted) events;
 *   - the demo's Acme data-residency AuditEvent payload carries the redacted ref and
 *     no raw value.
 *
 * Determinism preserved: ids/timestamps are literal here (no Date.now / Math.random).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalHash,
  stableStringify,
  isRedactedRef,
  verifyRedaction,
  type GovernanceCase,
  type RedactedRef,
} from "@liminal-engine/contracts";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import {
  AuditLedger,
  verifyChain,
  reconstructCaseLifecycle,
} from "./audit-ledger.ts";
import { reconstructCaseLifecycleFromEvents } from "./audit-reconstruction.ts";
import { redactAuditSnapshot, SENSITIVE_AUDIT_KEYS } from "./redact.ts";

const CASE = acmeScenario.governanceCase.id;
const DEAL = acmeScenario.governanceCase.dealId;
/** The raw sensitive customer-facing claim (single source — must never be sealed raw). */
const RAW = acmeScenario.sensitiveCustomerClaim;

function caseWithStatus(status: GovernanceCase["status"]): GovernanceCase {
  return { ...acmeScenario.governanceCase, status };
}

test("redactAuditSnapshot redacts only the sensitive keys; structural governance state passes through", () => {
  const gc = caseWithStatus("open");
  const snap = redactAuditSnapshot({
    governanceCase: gc, // structural — untouched
    dealStatus: "at-risk", // structural — untouched
    customerClaim: RAW, // sensitive — redacted
  });

  assert.deepEqual(snap.governanceCase, gc);
  assert.equal(snap.dealStatus, "at-risk");
  assert.ok(isRedactedRef(snap.customerClaim));
  assert.equal((snap.customerClaim as RedactedRef).hash, canonicalHash(RAW));
  // the raw value appears NOWHERE in the redacted snapshot
  assert.ok(!stableStringify(snap).includes(RAW));
  // customerClaim is in the configured sensitive policy
  assert.ok((SENSITIVE_AUDIT_KEYS as readonly string[]).includes("customerClaim"));
});

test("the audit-ledger writer never seals a raw sensitive value — it redacts at the write boundary", () => {
  const ledger = new AuditLedger();
  // append an event whose before/after snapshots carry the RAW sensitive claim.
  const sealed = ledger.append({
    id: "ae_residency",
    caseId: CASE,
    dealId: DEAL,
    action: "correction-enforced",
    decidingActor: "VP Ops / Head of AI Transformation",
    previousStatus: "on-track",
    newStatus: "at-risk",
    recordedAt: "2026-06-27T10:05:00.000Z",
    beforeState: { governanceCase: caseWithStatus("open"), customerClaim: RAW },
    afterState: { governanceCase: caseWithStatus("enforced"), customerClaim: RAW, dealStatus: "at-risk" },
  });

  // the SEALED payload stores the claim by reference, not raw
  assert.ok(isRedactedRef(sealed.beforeState?.customerClaim));
  assert.ok(isRedactedRef(sealed.afterState?.customerClaim));
  assert.equal((sealed.beforeState!.customerClaim as RedactedRef).hash, canonicalHash(RAW));

  // the WHOLE sealed chain, serialized, contains the reference (hash) but NOT the raw value
  const serialized = stableStringify(ledger.events());
  assert.ok(!serialized.includes(RAW), "raw sensitive value must never appear in the sealed chain");
  assert.ok(serialized.includes(canonicalHash(RAW)), "the redacted reference (hash) is what is stored");

  // structural (non-sensitive) governance state is preserved verbatim
  assert.deepEqual(sealed.afterState?.governanceCase, caseWithStatus("enforced"));
});

test("redaction does not break the hash chain or reconstruction (chain valid + lifecycle rebuilds)", () => {
  const ledger = new AuditLedger();
  ledger.append({
    id: "ae_open",
    caseId: CASE,
    dealId: DEAL,
    action: "case-opened",
    decidingActor: "Liminal detector",
    previousStatus: "on-track",
    newStatus: "on-track",
    recordedAt: acmeScenario.governanceCase.detectedAt,
    afterState: { governanceCase: caseWithStatus("open"), customerClaim: RAW },
  });
  ledger.append({
    id: "ae_enforced",
    caseId: CASE,
    dealId: DEAL,
    action: "correction-enforced",
    decidingActor: "VP Ops / Head of AI Transformation",
    previousStatus: "on-track",
    newStatus: "at-risk",
    recordedAt: acmeScenario.auditEvent.recordedAt,
    beforeState: { governanceCase: caseWithStatus("open"), customerClaim: RAW },
    afterState: { governanceCase: caseWithStatus("enforced"), dealStatus: "at-risk", customerClaim: RAW },
    actionIds: [acmeScenario.enforcementAction.id],
  });

  const events = ledger.events();

  // (a) the chain still verifies after redaction
  const chain = verifyChain(events);
  assert.equal(chain.valid, true);
  assert.equal(chain.length, 2);

  // (b) the lean reconstructor folds the lifecycle from the redacted events
  const lean = reconstructCaseLifecycle(events, CASE);
  assert.equal(lean.caseId, CASE);
  assert.equal(lean.dealStatus, "at-risk");

  // (c) the rich reconstructor rebuilds the GovernanceCase from the (non-sensitive)
  //     snapshots even though the sensitive fields were redacted
  const rich = reconstructCaseLifecycleFromEvents(events, CASE);
  assert.equal(rich.caseId, CASE);
  assert.deepEqual(rich.lifecycleStatuses, ["open", "enforced"]);
  assert.deepEqual(rich.current, caseWithStatus("enforced"));
  assert.deepEqual(rich.actionIds, [acmeScenario.enforcementAction.id]);
  // and the raw value is nowhere in the reconstructed timeline
  assert.ok(!stableStringify(rich).includes(RAW));
});

test("the Acme data-residency AuditEvent fixture carries the redacted reference — no raw value", () => {
  const ev = acmeScenario.dataResidencyAuditEvent;
  const ref = ev.beforeState?.customerClaim;
  assert.ok(isRedactedRef(ref));
  assert.equal((ref as RedactedRef).hash, canonicalHash(RAW));
  assert.ok(verifyRedaction(ref as RedactedRef, RAW));
  // the audit payload must not embed the raw sensitive value anywhere
  assert.ok(!stableStringify(ev).includes(RAW));

  // it appends + verifies through the ledger (idempotent — already a reference)
  const ledger = new AuditLedger();
  const { prevHash: _drop, ...payload } = ev;
  void _drop;
  const sealed = ledger.append(payload);
  assert.ok(isRedactedRef(sealed.beforeState?.customerClaim));
  assert.equal(verifyChain(ledger.events()).valid, true);
  assert.ok(!stableStringify(ledger.events()).includes(RAW));
});
