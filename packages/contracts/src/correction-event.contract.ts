/**
 * CorrectionEvent — the operator's correction of a GovernanceCase, recorded
 * before it compiles into EnforcementAction[]. (specs/SPEC.md: the human
 * correction that becomes enforceable operating state — the creative core of the
 * thesis.) Distinct from EnforcementAction (the compiled effect) and AuditEvent
 * (the recorded evidence): this is the correction intent itself.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const CORRECTION_EVENT_SCHEMA = "liminal_engine.correction_event.v1";

export const correctionEventShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  dealId: z.string().min(1),
  /** The corrected requirement / instruction the operator asserts. */
  correction: z.string().min(1),
  decidingActor: z.string().min(1), // a ROLE, never an invented persona name
  correctedAt: z.string().datetime(),
});
export type CorrectionEvent = z.infer<typeof correctionEventShape>;

export const correctionEventContract = defineContract({
  schema: CORRECTION_EVENT_SCHEMA,
  shape: correctionEventShape,
  canonical: (c) => ({
    schema: CORRECTION_EVENT_SCHEMA,
    id: c.id,
    case_id: c.caseId,
    deal_id: c.dealId,
    correction: c.correction,
    deciding_actor: c.decidingActor,
    corrected_at: c.correctedAt,
  }),
});

export const correctionEventGoldenVectors = [
  {
    name: "acme-eu-residency-correction",
    purpose: "operator corrects the dropped EU data residency requirement",
    input: {
      id: "ce_acme_eu",
      caseId: "gc_acme_eu",
      dealId: "deal_acme",
      correction: "EU data residency is a hard requirement; honor it before any on-track claim.",
      decidingActor: "VP Ops / Head of AI Transformation",
      correctedAt: "2026-06-27T10:03:00.000Z",
    } satisfies CorrectionEvent,
  },
];
