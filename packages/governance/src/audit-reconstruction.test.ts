import { test } from "node:test";
import assert from "node:assert/strict";
import {
  auditEventContract,
  type AuditEvent,
  type GovernanceCase,
} from "@liminal-engine/contracts";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import {
  hashAuditEvent,
  reconstructCaseLifecycleFromEvents,
  verifyAuditChain,
} from "./audit-reconstruction.ts";

const CASE_ID = acmeScenario.governanceCase.id;
const DEAL_ID = acmeScenario.governanceCase.dealId;

test("audit reconstruction rebuilds the Acme case lifecycle from AuditEvents only", () => {
  const events = acmeLifecycleAuditEvents();

  const chain = verifyAuditChain(events);
  assert.equal(chain.ok, true);
  assert.equal(chain.links.length, events.length);

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
  assert.equal(reconstructed.chainHeadHash, chain.headHash);
});

test("audit reconstruction detects a tampered hash chain", () => {
  const events = acmeLifecycleAuditEvents();
  const tampered = events.map((event, index) =>
    index === 0
      ? auditEventContract.parse({
          ...event,
          afterState: {
            governanceCase: {
              ...caseWithStatus("open"),
              missedRequirement: "EU data hosting",
            },
          },
        })
      : event,
  );

  const chain = verifyAuditChain(tampered);
  assert.equal(chain.ok, false);
  assert.equal(chain.error?.code, "prev-hash-mismatch");
  assert.equal(chain.error?.eventId, events[1]!.id);
  assert.throws(
    () => reconstructCaseLifecycleFromEvents(tampered, CASE_ID),
    /audit chain invalid at event/,
  );
});

function acmeLifecycleAuditEvents(): AuditEvent[] {
  const openCase = caseWithStatus("open");
  const enforcedCase = caseWithStatus("enforced");
  const closedCase = caseWithStatus("closed");

  return chainAuditEvents([
    {
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
    },
    {
      ...acmeScenario.auditEvent,
      beforeState: { governanceCase: openCase, dealStatus: "on-track" },
      afterState: { governanceCase: enforcedCase, dealStatus: "at-risk" },
      evidenceIds: ["evidence_acme_call_transcript"],
      actionIds: [acmeScenario.enforcementAction.id],
      affectedSystems: ["governance-case", "deal-status"],
    },
    {
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
    },
    {
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
    },
  ]);
}

function chainAuditEvents(events: readonly AuditEvent[]): AuditEvent[] {
  let prevHash: string | undefined;
  return events.map((event) => {
    const chained = auditEventContract.parse(
      prevHash === undefined ? event : { ...event, prevHash },
    );
    prevHash = hashAuditEvent(chained);
    return chained;
  });
}

function caseWithStatus(status: GovernanceCase["status"]): GovernanceCase {
  return { ...acmeScenario.governanceCase, status };
}
