/**
 * Predication fixtures — deterministic test data for the demo spine.
 * Used in acceptance tests and demo scenarios.
 */

import { predicationGoldenVectors, type Predication } from "./predication.contract.ts";

/**
 * The false-green predication: high confidence that was later refuted.
 * This is the core fixture for the Acme scenario — the agent made a high-confidence
 * claim that was falsified when the EU data-residency requirement was discovered.
 */
export const acmeFalseGreenPredication = predicationGoldenVectors.find(
  (v) => v.name === "false-green-acme-predication",
)!.input;

/**
 * The refuted predication: after the EU data-residency requirement was discovered,
 * the same predication now has low confidence.
 */
export const acmeRefutedPredication = predicationGoldenVectors.find(
  (v) => v.name === "refuted-predication",
)!.input;

/**
 * All predication fixtures for deterministic test runs.
 */
export const allPredicationFixtures: Predication[] = [
  acmeFalseGreenPredication,
  acmeRefutedPredication,
];
