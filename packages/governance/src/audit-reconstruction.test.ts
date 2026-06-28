import { test } from "node:test";
import assert from "node:assert/strict";
import { type GovernanceCase } from "@liminal-engine/contracts";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { AuditLedger, verifyChain, type SealedAuditEvent } from "./audit-ledger.ts";
import { reconstructCaseLifecycleFromEvents } from "./audit-reconstruction.ts";

const CASE_ID = acmeScenario.governanceCase.id;
const DEAL_ID = acmeScenario.governanceCase.dealId;

test("audit reconstruction rebuilds the Acme case lifecycle from AuditEvents only", () => {
  const events = acmeLifecycleAuditEvents();

  // chain verifies through the single ledger scheme (genesis-anchored, contract hash)
  const chain = verifyChain(events);
  assert.equal(chain.valid, true);
  assert.equal(chain.length, events.length);

  const reconstructed = reconstructCaseLifecycleFromEvents(events, CASE_ID);

  assert.equal(reconstructed.caseId, CASE_ID);
  assert.equal(reconstructed.dealId, DEAL_ID);
  assert.deepEqual(reconstructed.eventIds, events.map((event) => event.id));
  assert.deepEqual(reconstructed.lifecycleStatuses, ["open", "enforced", "closed"]);
  assert.deepEqual(reconstructed.actionIds, [acmeScenario.enforcementAction.id]);
  assert.deepEqual(reconstructed.evalIds, [
    acmeScenario.evalCase.id,
    acmeScenario.evalPass1.id,
    acmeScenario.evalPass2.id,
  ]);
  assert.deepEqual(reconstructed.current, caseWithStatus("closed"));
  // chainHeadHash anchors to the verified chain's tail eventHash
  assert.equal(reconstructed.chainHeadHash, events[events.length - 1]!.eventHash);
});

test("audit reconstruction detects a tampered hash chain", () => {
  const events = acmeLifecycleAuditEvents();
  // mutate the head event's payload AFTER sealing — its eventHash no longer matches
  // the payload, and (because every link chains forward) the head verification fails.
  const tampered: SealedAuditEvent[] = events.map((event, index) =>
    index === 0
      ? {
          ...event,
          afterState: {
            governanceCase: {
              ...caseWithStatus("open"),
              missedRequirement: "EU data hosting",
            },
          },
        }
      : event,
  );

  const chain = verifyChain(tampered);
  assert.equal(chain.valid, false);
  assert.equal(chain.brokenAt, 0);
  assert.throws(
    () => reconstructCaseLifecycleFromEvents(tampered, CASE_ID),
    /audit chain invalid at index/,
  );
});

/**
 * Build the Acme lifecycle as a SEALED chain via the ledger writer — the single
 * source of hashing/genesis. Each append assigns prevHash + eventHash; we never
 * hand-roll the chain (that's exactly the duplication this consolidation removed).
 */
function acmeLifecycleAuditEvents(): SealedAuditEvent[] {
  const openCase = caseWithStatus("open");
  const enforcedCase = caseWithStatus("enforced");
  const closedCase = caseWithStatus("closed");
  const ledger = new AuditLedger();

  ledger.append({
    id: "ae_acme_case_opened",
    caseId: CASE_ID,
    dealId: DEAL_ID,
    action: "case-opened",
    decidingActor: "Liminal detector",
    previousStatus: "on-track",
    newStatus: "on-track",
    recordedAt: acmeScenario.governanceCase.detectedAt,
    afterState: { governanceCase: openCase },
    evidenceIds: ["evidence_acme_call_transcript"],
    affectedSystems: ["governance-case"],
  });

  ledger.append({
    ...stripPrevHash(acmeScenario.auditEvent),
    beforeState: { governanceCase: openCase, dealStatus: "on-track" },
    afterState: { governanceCase: enforcedCase, dealStatus: "at-risk" },
    evidenceIds: ["evidence_acme_call_transcript"],
    actionIds: [acmeScenario.enforcementAction.id],
    affectedSystems: ["governance-case", "deal-status"],
  });

  ledger.append({
    id: "ae_acme_eval_generated",
    caseId: CASE_ID,
    dealId: DEAL_ID,
    action: "eval-generated",
    decidingActor: "Eval harness",
    previousStatus: "at-risk",
    newStatus: "at-risk",
    recordedAt: acmeScenario.evalCase.createdAt,
    beforeState: { governanceCase: enforcedCase },
    afterState: { governanceCase: enforcedCase, evalCase: acmeScenario.evalCase },
    evalIds: [acmeScenario.evalCase.id],
    affectedSystems: ["eval-harness"],
  });

  ledger.append({
    id: "ae_acme_case_closed",
    caseId: CASE_ID,
    dealId: DEAL_ID,
    action: "case-closed",
    decidingActor: "Eval harness",
    previousStatus: "at-risk",
    newStatus: "at-risk",
    recordedAt: "2026-06-27T10:07:00.000Z",
    beforeState: {
      governanceCase: enforcedCase,
      evalResults: [acmeScenario.evalPass1, acmeScenario.evalPass2],
    },
    afterState: {
      governanceCase: closedCase,
      evalResults: [acmeScenario.evalPass1, acmeScenario.evalPass2],
    },
    evalIds: [acmeScenario.evalPass1.id, acmeScenario.evalPass2.id],
    affectedSystems: ["governance-case", "eval-harness"],
  });

  return ledger.events();
}

/** The ledger assigns prevHash itself; drop any prevHash the fixture carries. */
function stripPrevHash<T extends { prevHash?: string }>(event: T): Omit<T, "prevHash"> {
  const { prevHash: _drop, ...rest } = event;
  return rest;
}

function caseWithStatus(status: GovernanceCase["status"]): GovernanceCase {
  return { ...acmeScenario.governanceCase, status };
}
