/**
 * Predication — a claim about the world with confidence, evidence, and refutation paths.
 *
 * A Predication models an assertion made by an agent (e.g., "Acme expansion is on-track").
 * The contract captures:
 *   - assertion: what is claimed (the actual statement)
 *   - confidence: numeric confidence [0, 1]
 *   - evidence: supporting facts or observations
 *   - refutationPaths: conditions that would falsify the claim
 *
 * Used to model the false-green claim ('Acme on-track' = high-confidence predication that was refuted).
 * See DEMO_CONTRACT.md for context.
 */
import { z } from "zod";
import { defineContract } from "@liminal-engine/contracts";

export const PREDICATION_SCHEMA = "liminal_engine.predication.v1";

export const predictionConfidence = z.number().min(0).max(1);
export type PredictionConfidence = z.infer<typeof predictionConfidence>;

export const refutationPathShape = z.object({
  description: z.string().min(1),
  weight: z.number().min(0).max(1), // importance/likelihood
});
export type RefutationPath = z.infer<typeof refutationPathShape>;

export const predicationShape = z.object({
  id: z.string().min(1),
  assertion: z.string().min(1),
  confidence: predictionConfidence,
  evidence: z.array(z.string().min(1)), // supporting facts/observations
  refutationPaths: z.array(refutationPathShape), // conditions that would falsify this
  timestamp: z.number().int().positive(), // when the predication was made
});
export type Predication = z.infer<typeof predicationShape>;

export const predicationContract = defineContract({
  schema: PREDICATION_SCHEMA,
  shape: predicationShape,
  canonical: (p) => ({
    schema: PREDICATION_SCHEMA,
    id: p.id,
    assertion: p.assertion,
    confidence: p.confidence,
    evidence: [...p.evidence].sort(), // order-stable
    refutation_paths: p.refutationPaths
      .map((r) => ({
        description: r.description,
        weight: r.weight,
      }))
      .sort((a, b) => a.description.localeCompare(b.description)), // order-stable
    timestamp: p.timestamp,
  }),
});

export const predicationGoldenVectors = [
  {
    name: "false-green-acme-predication",
    purpose: "high-confidence predication that was refuted (EU data-residency)",
    input: {
      id: "pred_acme_on_track",
      assertion: "Acme expansion is on-track for close by Friday",
      confidence: 0.95,
      evidence: [
        "All sales workstream milestones met",
        "Customer stakeholder engagement positive",
        "Legal terms drafted and circulated",
      ],
      refutationPaths: [
        {
          description: "EU data residency requirement not satisfied",
          weight: 1.0,
        },
        {
          description: "Customer budget revision or delay",
          weight: 0.3,
        },
        {
          description: "Legal escalation on IP indemnity",
          weight: 0.2,
        },
      ],
      timestamp: 1719345600, // 2024-06-25T12:00:00Z
    } satisfies Predication,
  },
  {
    name: "refuted-predication",
    purpose: "low-confidence predication after refutation evidence",
    input: {
      id: "pred_acme_on_track_post",
      assertion: "Acme expansion is on-track for close by Friday",
      confidence: 0.1,
      evidence: [
        "EU data residency requirement was silently dropped (REFUTED)",
        "Customer requirement not met",
        "Legal constraint blocks forward motion",
      ],
      refutationPaths: [
        {
          description: "EU data residency requirement not satisfied",
          weight: 1.0,
        },
      ],
      timestamp: 1719349200, // 2024-06-25T13:00:00Z
    } satisfies Predication,
  },
];
