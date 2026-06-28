/**
 * Tests for signal-harness: DriftSignal contract + detection logic.
 *
 * Coverage:
 * - DriftSignal schema validation (golden vectors)
 * - Detection logic for all signal types
 * - Confidence scoring
 * - Evidence generation
 * - Case-opening decisions
 * - Edge cases (empty output, no violations, convergence patterns)
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { DriftSignal } from "../src/signal.contract.ts";
import {
  driftSignalShape,
  driftSignalGoldenVectors,
} from "../src/signal.contract.ts";
import {
  detectDrift,
  containsAllAnchors,
  violatesConstraints,
  type DetectionContext,
} from "../src/detect-drift.ts";

test("DriftSignal contract — golden vectors validate", () => {
  for (const vector of driftSignalGoldenVectors) {
    const result = driftSignalShape.safeParse(vector.input);
    assert.ok(result.success, `Golden vector '${vector.name}' failed validation: ${result.error}`);
  }
});

test("DriftSignal contract — required fields are present", () => {
  const signal = driftSignalGoldenVectors[0]?.input;
  assert.ok(signal, "golden vector exists");
  assert.ok(signal!.id, "id is required");
  assert.ok(signal!.type, "type is required");
  assert.ok(signal!.severity, "severity is required");
  assert.ok(typeof signal!.score === "number", "score is required");
  assert.ok(Array.isArray(signal!.evidence), "evidence is required");
  assert.ok(signal!.detectorVersion, "detectorVersion is required");
  assert.ok(signal!.caseId, "caseId is required");
  assert.ok(signal!.detectedAt, "detectedAt is required");
});

test("DriftSignal — score must be 0-1", () => {
  const baseSignal = driftSignalGoldenVectors[0]?.input;
  assert.ok(baseSignal, "golden vector exists");
  const invalidSignal = {
    ...baseSignal!,
    score: 1.5,
  };
  const result = driftSignalShape.safeParse(invalidSignal);
  assert.ok(!result.success, "score > 1 should fail validation");
});

test("detectDrift — missing required anchor generates signal", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: ["EU data residency", "GDPR compliance"],
    hardConstraints: [],
  };

  const output = "The contract was signed. GDPR compliance is met.";
  const result = detectDrift(output, context);

  assert.ok(result.signals.length > 0, "Should generate signals for missing anchors");
  const missingSignal = result.signals.find((s) => s.type === "missing_required_anchor");
  assert.ok(missingSignal, "Should have missing_required_anchor signal");
  assert.equal(missingSignal!.severity, "high");
  assert.ok(missingSignal!.score > 0.85, "Missing anchor should have high confidence");
});

test("detectDrift — hard constraint violation generates signal", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: [],
    hardConstraints: [
      {
        type: "forbid_pattern",
        target: "proceed without approval",
        reason: "approval gate must be checked",
      },
    ],
  };

  const output = "Agent decided to proceed without approval from the security team.";
  const result = detectDrift(output, context);

  assert.ok(result.signals.length > 0, "Should generate signals for constraint violations");
  const constraintSignal = result.signals.find((s) => s.type === "hard_constraint_violation");
  assert.ok(constraintSignal, "Should have hard_constraint_violation signal");
  assert.equal(constraintSignal!.severity, "critical");
  assert.ok(constraintSignal!.score >= 0.95, "Constraint violation should have very high confidence");
});

test("detectDrift — compliant output generates no signals", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: ["signed", "compliant"],
    hardConstraints: [
      {
        type: "forbid_pattern",
        target: "unapproved",
        reason: "must be approved",
      },
    ],
  };

  const output = "The contract was signed and is fully compliant with all requirements.";
  const result = detectDrift(output, context);

  assert.equal(result.signals.length, 0, "Compliant output should generate no signals");
  assert.ok(!result.shouldOpenCase, "Should not open case for compliant output");
});

test("detectDrift — JSON schema validation failure generates signal", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: [],
    hardConstraints: [],
    outputSchema: {
      status: "string",
      requirements: "array",
    },
  };

  const output = 'Not valid JSON';
  const result = detectDrift(output, context);

  assert.ok(result.signals.length > 0, "Should generate signal for non-JSON output");
  const schemaSignal = result.signals.find((s) => s.type === "output_schema_violation");
  assert.ok(schemaSignal, "Should have schema violation signal");
});

test("detectDrift — missing schema fields generates signal", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: [],
    hardConstraints: [],
    outputSchema: {
      status: "string",
      approvalRequired: "boolean",
    },
  };

  const output = JSON.stringify({ status: "on-track" });
  const result = detectDrift(output, context);

  assert.ok(result.signals.length > 0, "Should generate signal for missing schema fields");
  const schemaSignal = result.signals.find((s) => s.type === "output_schema_violation");
  assert.ok(schemaSignal, "Should have schema violation signal");
  assert.ok(
    schemaSignal!.evidence.some((e) => e.includes("approvalRequired")),
    "Evidence should mention missing field"
  );
});

test("detectDrift — multiple violations converge to case-open decision", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: ["security review", "compliance check"],
    hardConstraints: [
      {
        type: "forbid_pattern",
        target: "skip verification",
        reason: "verification is mandatory",
      },
    ],
  };

  const output = "Proceeding with the deal. Skipping verification step.";
  const result = detectDrift(output, context);

  assert.ok(result.signals.length >= 2, "Should generate multiple signals");
  assert.ok(result.shouldOpenCase, "Multiple signals should trigger case opening");
});

test("detectDrift — signal confidence scoring reflects severity", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: ["security_review_required"],
    hardConstraints: [
      {
        type: "forbid_pattern",
        target: "skip verification",
        reason: "verification is mandatory",
      },
    ],
  };

  const output = "The process continued despite the need to skip verification. Security review required.";
  const result = detectDrift(output, context);

  const hardConstraintSignal = result.signals.find((s) => s.type === "hard_constraint_violation");
  const missingAnchorSignal = result.signals.find((s) => s.type === "missing_required_anchor");

  assert.ok(hardConstraintSignal, "Should have hard_constraint_violation signal");
  assert.ok(missingAnchorSignal, "Should have missing_required_anchor signal");
  assert.ok(
    hardConstraintSignal!.score >= missingAnchorSignal!.score,
    "Hard constraint violations should have higher confidence than missing anchors"
  );
});

test("detectDrift — totalScore reflects composite risk", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: ["anchor1", "anchor2"],
    hardConstraints: [],
  };

  const output = "Missing both anchors.";
  const result = detectDrift(output, context);

  assert.ok(result.totalScore > 0, "Should have non-zero composite score for violations");
  assert.ok(result.totalScore <= 1, "Composite score should not exceed 1");
});

test("containsAllAnchors — validates all anchors present", () => {
  const anchors = ["required1", "required2"];
  const output = "The required1 and required2 are both present.";

  assert.ok(containsAllAnchors(output, anchors), "All anchors present should return true");
});

test("containsAllAnchors — fails if any anchor missing", () => {
  const anchors = ["required1", "required2"];
  const output = "Only required1 is present.";

  assert.ok(!containsAllAnchors(output, anchors), "Missing anchor should return false");
});

test("violatesConstraints — detects forbidden patterns", () => {
  const constraints = [
    {
      type: "forbid_pattern" as const,
      target: "skip approval",
      reason: "approval required",
    },
  ];

  const output = "Proceeding to skip approval and move forward.";
  assert.ok(
    violatesConstraints(output, constraints),
    "Forbidden pattern should be detected"
  );
});

test("violatesConstraints — passes when no violations", () => {
  const constraints = [
    {
      type: "forbid_pattern" as const,
      target: "skip approval",
      reason: "approval required",
    },
  ];

  const output = "Obtained approval before proceeding.";
  assert.ok(
    !violatesConstraints(output, constraints),
    "No forbidden pattern should pass"
  );
});

test("detectDrift — signal IDs are unique per detection", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: ["anchor1", "anchor2", "anchor3"],
    hardConstraints: [],
  };

  const output = "Missing all anchors.";
  const result = detectDrift(output, context);

  const ids = new Set(result.signals.map((s) => s.id));
  assert.equal(ids.size, result.signals.length, "All signal IDs should be unique");
});

test("detectDrift — evidence references are present in all signals", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: ["anchor"],
    hardConstraints: [
      {
        type: "forbid_pattern",
        target: "forbidden",
        reason: "not allowed",
      },
    ],
  };

  const output = "Missing anchor and contains forbidden.";
  const result = detectDrift(output, context);

  for (const signal of result.signals) {
    assert.ok(Array.isArray(signal.evidence), `Signal ${signal.id} must have evidence array`);
    assert.ok(signal.evidence.length > 0, `Signal ${signal.id} must have at least one evidence item`);
  }
});

test("detectDrift — case-opening threshold is at least one signal with score >= 0.7 OR >=2 signals", () => {
  // Test: one signal with score >= 0.7 should open case
  const context1: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: [],
    hardConstraints: [
      {
        type: "forbid_pattern",
        target: "critical",
        reason: "critical violation",
      },
    ],
  };

  const output1 = "Contains critical pattern";
  const result1 = detectDrift(output1, context1);
  assert.ok(result1.shouldOpenCase, "One critical signal should open case");

  // Test: two signals should open case even if scores lower
  const context2: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: ["anchor1", "anchor2"],
    hardConstraints: [],
  };

  const output2 = "Missing both anchors";
  const result2 = detectDrift(output2, context2);
  assert.ok(result2.shouldOpenCase, "Two signals should open case");
});

test("detectDrift — empty output triggers missing anchor signals", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: ["something"],
    hardConstraints: [],
  };

  const output = "";
  const result = detectDrift(output, context);

  assert.ok(result.signals.length > 0, "Empty output should trigger signals");
  assert.ok(!result.shouldOpenCase === false, "Empty output missing anchors should consider opening case");
});

test("DriftSignal — detector version is tracked", () => {
  const context: DetectionContext = {
    goalId: "goal_test",
    caseId: "case_test",
    requiredAnchors: ["anchor"],
    hardConstraints: [],
  };

  const output = "Missing anchor";
  const result = detectDrift(output, context);

  for (const signal of result.signals) {
    assert.ok(signal.detectorVersion.startsWith("v"), "Detector version should be semantic version");
    assert.ok(signal.detectorVersion, "All signals must record detector version");
  }
});
