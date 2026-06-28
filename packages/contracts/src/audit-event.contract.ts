/**
 * AuditEvent — recorded evidence of a correction + the deciding actor and the
 * status flip (on-track → at-risk). Ports onto liminal-agents-v1's anchor-receipt
 * pattern (canonical hash = tamper-evident receipt). Persona rule: actor is a
 * ROLE, never an invented name. (DEMO_CONTRACT step 5.)
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";
import { dealStatus } from "./agent-output.contract.ts";

export const AUDIT_EVENT_SCHEMA = "liminal_engine.audit_event.v1";

export const auditEventShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  dealId: z.string().min(1),
  action: z.string().min(1),
  decidingActor: z.string().min(1), // a ROLE — e.g. "VP Ops / Head of AI Transformation"
  previousStatus: dealStatus,
  newStatus: dealStatus,
  recordedAt: z.string().datetime(),
});
export type AuditEvent = z.infer<typeof auditEventShape>;

export const auditEventContract = defineContract({
  schema: AUDIT_EVENT_SCHEMA,
  shape: auditEventShape,
  canonical: (e) => ({
    schema: AUDIT_EVENT_SCHEMA,
    id: e.id,
    case_id: e.caseId,
    deal_id: e.dealId,
    action: e.action,
    deciding_actor: e.decidingActor,
    previous_status: e.previousStatus,
    new_status: e.newStatus,
    recorded_at: e.recordedAt,
  }),
});

export const auditEventGoldenVectors = [
  {
    name: "acme-correction-enforced",
    purpose: "correction recorded — status flips on-track -> at-risk, actor is a role",
    input: {
      id: "ae_acme_1",
      caseId: "gc_acme_eu",
      dealId: "deal_acme",
      action: "correction-enforced",
      decidingActor: "VP Ops / Head of AI Transformation",
      previousStatus: "on-track",
      newStatus: "at-risk",
      recordedAt: "2026-06-27T10:05:00.000Z",
    } satisfies AuditEvent,
  },
];
