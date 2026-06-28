export {
  DRIFT_SIGNAL_SCHEMA,
  driftSignalType,
  driftSignalSeverity,
  driftSignalShape,
  driftSignalGoldenVectors,
  type DriftSignal,
  type DriftSignalType,
  type DriftSignalSeverity,
} from "./signal.contract.ts";

export {
  detectDrift,
  containsAllAnchors,
  violatesConstraints,
  detectionContextShape,
  detectionResultShape,
  type DetectionContext,
  type DetectionResult,
} from "./detect-drift.ts";
