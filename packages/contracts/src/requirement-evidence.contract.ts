/**
 * RequirementEvidence — a captured, tamper-evident pointer to where a customer
 * requirement was actually stated (a call transcript span, a signed-contract
 * clause, an email, …). It is the provenance a user-authored `Requirement`
 * (`requirement.contract.ts`) cites in its `evidenceRefs[]`: not the requirement
 * itself, but the *source* receipt that the requirement is grounded in.
 *
 * The `hash` is a content-hash reference of the quoted source span (sha256 hex via
 * the package's `sha256Hex`), so the evidence is a reproducible receipt that ports
 * onto the same canonical-hash anchor as the rest of the contracts kernel — the
 * quote can be re-verified against the source without storing the raw artifact.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const REQUIREMENT_EVIDENCE_SCHEMA = "liminal_engine.requirement_evidence.v1";

export const requirementEvidenceShape = z
  .object({
    /** id of the source artifact the evidence was captured from (transcript, doc, …). */
    sourceId: z.string().min(1),
    /** kind of source — free-form (e.g. "call-transcript", "signed-contract", "email"). */
    sourceType: z.string().min(1),
    /** locator of the cited span within the source (e.g. "00:12:30-00:12:58", "Section 7.2"). */
    span: z.string().min(1),
    /** the exact quoted text that states the requirement. */
    quote: z.string().min(1),
    /** content-hash reference of the quoted source span — a reproducible receipt. */
    hash: z.string().min(1),
    /** when the evidence was captured. */
    capturedAt: z.string().datetime(),
  })
  .strict();
export type RequirementEvidence = z.infer<typeof requirementEvidenceShape>;

export const requirementEvidenceContract = defineContract({
  schema: REQUIREMENT_EVIDENCE_SCHEMA,
  shape: requirementEvidenceShape,
  canonical: (e) => ({
    schema: REQUIREMENT_EVIDENCE_SCHEMA,
    source_id: e.sourceId,
    source_type: e.sourceType,
    span: e.span,
    quote: e.quote,
    hash: e.hash,
    captured_at: e.capturedAt,
  }),
});

export const requirementEvidenceGoldenVectors = [
  {
    name: "acme-eu-residency-call",
    purpose: "evidence the EU data residency requirement was stated on the kickoff call",
    input: {
      sourceId: "call_acme_kickoff",
      sourceType: "call-transcript",
      span: "00:12:30-00:12:58",
      quote: "All customer data for EU subsidiaries must remain in EU data centers; this is a contractual obligation.",
      hash: "550d305ae8408bec196d3cae7d5a9a0bc63b17bacc7b68160add3f6b024e45ee",
      capturedAt: "2026-06-27T09:45:00.000Z",
    } satisfies RequirementEvidence,
  },
  {
    name: "acme-eu-residency-dpa",
    purpose: "evidence the same requirement is codified in the signed DPA clause",
    input: {
      sourceId: "dpa_acme_v3",
      sourceType: "signed-contract",
      span: "Section 7.2",
      quote: "Processing of EU Personal Data shall occur solely within the European Economic Area.",
      hash: "2fbdb6b3ac952fb5b28317eba8114760b88f30c1237e4bf3542dd21b0c7d9023",
      capturedAt: "2026-06-27T09:50:00.000Z",
    } satisfies RequirementEvidence,
  },
];
