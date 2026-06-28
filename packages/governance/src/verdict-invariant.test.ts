/**
 * Verdict single-source-of-truth invariant/property test (LIM-1233).
 *
 * Locks the fail-OPEN desync class shut. The merge-blocking anti-pattern
 * IDEAS.md flags is persisting a permit boolean (`allowed`/`blocked`) ALONGSIDE
 * the gate verdict: the two can drift, and a stale `allowed:true` silently lets a
 * gated customer-facing action through. The fix (gov-proxy / LIM-1230) made the
 * gate **verdict** the single source of truth and DERIVES the permit state from
 * it (`deriveActionGateAllowed`). This test proves that property holds for EVERY
 * possible gate input and — critically — that it would FAIL the moment a
 * contradictory persisted `allowed`/`blocked` boolean is reintroduced.
 *
 * It pairs with «gov-proxy» (LIM-1230): proxy-gate.ts is the consumer that must
 * never emit such a boolean, so the proxy gate is exercised here too.
 *
 * Strategy = an EXHAUSTIVE (hence fully deterministic — no RNG, no Clock) sweep
 * of the finite gate input space: every verdict × every reasons/requiredBeforeSend
 * shape × every provenance × multiple identities. The verdict + source spaces are
 * driven straight from the contract enums, so adding a new verdict/source can't
 * silently slip past these invariants (a completeness guard fails until covered).
 *
 * Refs: specs/IDEAS.md (Enforcement: fail-closed, verdict SSOT); contract
 * `packages/contracts/src/action-gate.contract.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionGateContract,
  actionGateVerdictShape,
  actionGateSourceShape,
  deriveActionGateAllowed,
  actionGateDecision,
  isAllowed,
  type ActionGate,
} from "@liminal-engine/contracts";
import { buildGate } from "./proxy-gate.ts";

// ── The COMPLETE input space, driven from the contract so it can't go stale ──

/** Every verdict the contract admits — drives the sweep AND the completeness guard. */
const ALL_VERDICTS = actionGateVerdictShape.options; // ["allow", "deny"]
/** Every provenance the contract admits. */
const ALL_SOURCES = actionGateSourceShape.options; // ["operator","policy","scope","default-deny"]

/**
 * The persisted permit-boolean field names a fail-open regression would
 * reintroduce. The acceptance criterion is "allowed"/"blocked"; the synonyms
 * widen the net so a sneaky re-spelling is caught too.
 */
const FORBIDDEN_PERMIT_FIELDS = [
  "allowed",
  "blocked",
  "permitted",
  "permit",
  "denied",
  "isAllowed",
  "is_allowed",
  "isBlocked",
  "is_blocked",
] as const;

const REASON_VARIANTS: readonly string[][] = [[], ["case must be corrected first"], ["reason a", "reason b"]];
const REQUIRED_VARIANTS: readonly string[][] = [[], ["propagate the requirement"], ["assign owners", "pass the eval"]];
const SOURCE_VARIANTS: readonly (string | undefined)[] = [undefined, ...ALL_SOURCES];
const SOURCE_RULE_ID_VARIANTS: readonly (string | undefined)[] = [undefined, "pr_rule_dual_review_v1"];
const IDENTITY_VARIANTS: readonly { id: string; caseId: string; action: string }[] = [
  { id: "ag_one", caseId: "gc_one", action: "Send customer-facing status update to Acme" },
  { id: "ag_two", caseId: "gc_two", action: "Force-push to a protected branch" },
];

/**
 * The contract's verdict-detail invariants (action-gate.contract.ts superRefine),
 * expressed independently here so a weakening of those rules is detected: a deny
 * must carry at least one reason; an allow must carry no reasons and no required
 * remediation. Anything else is an invalid gate the contract must reject.
 */
function isStructurallyValid(verdict: string, reasons: readonly string[], required: readonly string[]): boolean {
  if (verdict === "deny") return reasons.length >= 1;
  if (verdict === "allow") return reasons.length === 0 && required.length === 0;
  return false; // unknown verdict — the completeness guard turns this into a loud failure
}

function rawGate(
  verdict: string,
  reasons: readonly string[],
  required: readonly string[],
  source: string | undefined,
  sourceRuleId: string | undefined,
  identity: { id: string; caseId: string; action: string },
): Record<string, unknown> {
  return {
    ...identity,
    verdict,
    reasons: [...reasons],
    requiredBeforeSend: [...required],
    ...(source !== undefined ? { source } : {}),
    ...(sourceRuleId !== undefined ? { sourceRuleId } : {}),
  };
}

interface Combo {
  raw: Record<string, unknown>;
  valid: boolean;
  verdict: string;
}

/** The full cartesian product of the input space (deterministic iteration order). */
function enumerateGateInputs(): Combo[] {
  const combos: Combo[] = [];
  for (const verdict of ALL_VERDICTS) {
    for (const reasons of REASON_VARIANTS) {
      for (const required of REQUIRED_VARIANTS) {
        for (const source of SOURCE_VARIANTS) {
          for (const sourceRuleId of SOURCE_RULE_ID_VARIANTS) {
            for (const identity of IDENTITY_VARIANTS) {
              combos.push({
                raw: rawGate(verdict, reasons, required, source, sourceRuleId, identity),
                valid: isStructurallyValid(verdict, reasons, required),
                verdict,
              });
            }
          }
        }
      }
    }
  }
  return combos;
}

// ────────────────────────────────── tests ──────────────────────────────────

test("LIM-1233 completeness: the verdict + source spaces match the contract enums (a new verdict/source must extend this test)", () => {
  // If a verdict like "hold"/"escalate" is added without defining its permit
  // semantics here, this fails first — no silent bypass of the SSOT invariant.
  assert.deepEqual([...ALL_VERDICTS].slice().sort(), ["allow", "deny"]);
  assert.deepEqual([...ALL_SOURCES].slice().sort(), ["default-deny", "operator", "policy", "scope"]);
});

test("LIM-1233 property: across EVERY gate input, the derived permit state is a pure function of the verdict (single source of truth)", () => {
  const combos = enumerateGateInputs();
  let validCount = 0;
  let invalidCount = 0;

  for (const { raw, valid } of combos) {
    if (!valid) {
      // The verdict-detail invariants hold: a contradictory verdict/details combo
      // is unrepresentable. (Weakening the superRefine makes this throw fail.)
      assert.throws(
        () => actionGateContract.parse(raw),
        `expected an invalid verdict/details combo to be rejected: ${JSON.stringify(raw)}`,
      );
      invalidCount++;
      continue;
    }

    const gate = actionGateContract.parse(raw);
    validCount++;

    // THE invariant: permit state is decided by the verdict and nothing else.
    const expectedAllowed = gate.verdict === "allow";
    assert.equal(
      deriveActionGateAllowed(gate),
      expectedAllowed,
      `deriveActionGateAllowed disagreed with the verdict for ${JSON.stringify(raw)}`,
    );
    // Every reader derives the SAME answer — no path can desync from the verdict.
    assert.equal(isAllowed(gate), expectedAllowed, `isAllowed disagreed with the verdict for ${JSON.stringify(raw)}`);
    assert.equal(
      actionGateDecision(gate).allowed,
      expectedAllowed,
      `actionGateDecision.allowed disagreed with the verdict for ${JSON.stringify(raw)}`,
    );
    // The decision faithfully mirrors the verdict's reasons/required (no fabrication/loss).
    assert.deepEqual(actionGateDecision(gate).reasons, gate.reasons);
    assert.deepEqual(actionGateDecision(gate).requiredBeforeSend, gate.requiredBeforeSend);

    // Provenance is orthogonal to permit state: attaching/removing source must not
    // move the needle (the verdict, not who set it, decides allowance).
    assert.equal(
      deriveActionGateAllowed({ verdict: gate.verdict, reasons: gate.reasons, requiredBeforeSend: gate.requiredBeforeSend }),
      expectedAllowed,
    );
  }

  // Guard against a vacuous pass: the sweep must actually exercise BOTH branches,
  // at exactly the sizes the input space + contract invariants dictate. If the
  // refine rules change, these counts shift and this fails loudly.
  assert.equal(combos.length, 360, "input-space size changed unexpectedly");
  assert.equal(validCount, 140, "count of contract-valid gates changed (verdict-detail invariants drifted?)");
  assert.equal(invalidCount, 220, "count of contract-rejected gates changed (verdict-detail invariants drifted?)");
});

test("LIM-1233 invariant: a persisted allowed/blocked boolean is unrepresentable — the schema rejects it (THIS TEST FAILS if such a field is reintroduced)", () => {
  // One contract-valid base per verdict.
  const validBases: readonly Record<string, unknown>[] = [
    { id: "ag_allow", caseId: "gc_allow", action: "Send customer-facing status update to Acme", verdict: "allow", reasons: [], requiredBeforeSend: [] },
    {
      id: "ag_deny",
      caseId: "gc_deny",
      action: "Send customer-facing status update to Acme",
      verdict: "deny",
      reasons: ["Open governance case requires correction first."],
      requiredBeforeSend: ["Pass the EU data residency EvalCase."],
    },
  ];

  for (const base of validBases) {
    assert.doesNotThrow(() => actionGateContract.parse(base), `base gate should be valid: ${JSON.stringify(base)}`);

    for (const field of FORBIDDEN_PERMIT_FIELDS) {
      for (const boolValue of [true, false]) {
        // .strict() ⇒ any persisted permit boolean is an "Unrecognized key". If a
        // future change re-adds `allowed`/`blocked` to the shape (or drops
        // .strict()), parse stops throwing and this assertion fails.
        assert.throws(
          () => actionGateContract.parse({ ...base, [field]: boolValue }),
          /Unrecognized key/,
          `reintroducing a persisted '${field}' boolean must be rejected (verdict=${String(base.verdict)}, value=${boolValue})`,
        );
      }
    }
  }
});

test("LIM-1233 invariant: the persisted (canonical) gate carries the verdict but NO permit boolean — allowed is always re-derived, never stored", () => {
  for (const { raw, valid } of enumerateGateInputs()) {
    if (!valid) continue;
    const gate = actionGateContract.parse(raw);
    const projection = actionGateContract.canonical(gate) as Record<string, unknown>;

    // The verdict IS persisted — it is the source of truth.
    assert.equal(projection.verdict, gate.verdict, `canonical projection must persist the verdict for ${JSON.stringify(raw)}`);

    // No permit-boolean field name appears on either the parsed gate or its
    // persisted projection.
    for (const field of FORBIDDEN_PERMIT_FIELDS) {
      assert.ok(!(field in projection), `canonical projection must not persist a '${field}' field`);
      assert.ok(!(field in gate), `parsed gate must not carry a '${field}' field`);
    }

    // Stronger still: the persisted form carries NO boolean at all. The permit
    // state is never serialized — it is only ever re-derived from `verdict`. A
    // reintroduced persisted boolean (whatever its name) trips this.
    for (const [key, value] of Object.entries(projection)) {
      assert.notEqual(
        typeof value,
        "boolean",
        `canonical projection field '${key}' is a boolean — permit state must NOT be persisted (verdict is the single source of truth)`,
      );
    }
  }
});

test("LIM-1233 invariant: re-deriving from the persisted verdict alone reproduces the permit state (no second source can contradict it)", () => {
  for (const { raw, valid } of enumerateGateInputs()) {
    if (!valid) continue;
    const gate = actionGateContract.parse(raw);
    const projection = actionGateContract.canonical(gate) as Record<string, unknown>;

    // Simulate persist → reload: the ONLY thing the reloaded record can offer to
    // decide allowance is its verdict. Re-derive from that alone.
    const reDerivedFromPersistedVerdict = projection.verdict === "allow";
    assert.equal(
      reDerivedFromPersistedVerdict,
      deriveActionGateAllowed(gate),
      `permit state re-derived from the persisted verdict must match the live derivation for ${JSON.stringify(raw)}`,
    );
  }
});

test("LIM-1233 invariant: a contradictory allowed/blocked boolean slapped onto a gate cannot change the derived permit state", () => {
  const deny = actionGateContract.parse({
    id: "ag_deny",
    caseId: "gc_deny",
    action: "Send customer-facing status update to Acme",
    verdict: "deny",
    reasons: ["Open governance case requires correction first."],
    requiredBeforeSend: ["Pass the EU data residency EvalCase."],
  });
  const allow = actionGateContract.parse({
    id: "ag_allow",
    caseId: "gc_allow",
    action: "Send customer-facing status update to Acme",
    verdict: "allow",
    reasons: [],
    requiredBeforeSend: [],
  });

  // Tamper in memory: attach every contradictory permit boolean we can think of.
  const tamperedDeny: Record<string, unknown> = { ...deny };
  const tamperedAllow: Record<string, unknown> = { ...allow };
  for (const field of FORBIDDEN_PERMIT_FIELDS) {
    tamperedDeny[field] = true; // try to force-OPEN a deny
    tamperedAllow[field] = false; // try to force-CLOSE an allow
  }

  // The derivation reads the VERDICT, never a boolean — so the tamper is inert.
  // (If anyone rewires deriveActionGateAllowed to read `allowed`/`blocked`, these flip.)
  assert.equal(deriveActionGateAllowed(tamperedDeny as unknown as ActionGate), false, "a deny verdict must stay not-allowed despite allowed=true");
  assert.equal(deriveActionGateAllowed(tamperedAllow as unknown as ActionGate), true, "an allow verdict must stay allowed despite blocked=true");
  assert.equal(isAllowed(tamperedDeny as unknown as ActionGate), false);
  assert.equal(isAllowed(tamperedAllow as unknown as ActionGate), true);
  assert.equal(actionGateDecision(tamperedDeny as unknown as ActionGate).allowed, false);
  assert.equal(actionGateDecision(tamperedAllow as unknown as ActionGate).allowed, true);
});

test("LIM-1233 pairs with «gov-proxy» (LIM-1230): proxy-gate buildGate emits a verdict-sourced deny with no persisted permit boolean", () => {
  // Deterministic id (no Clock/RNG) so the proxy gate is reproducible.
  const idGen = { next: () => "ag_proxy_invariant" };
  const gate = buildGate("Send customer-facing status update to Acme", "gc_acme_eu", idGen);

  // It must be a contract-valid gate (round-trips through parse with no extra keys).
  const parsed = actionGateContract.parse(gate);
  assert.equal(parsed.verdict, "deny");

  // Permit state derives to false from the verdict alone — the customer update stays gated (MNC#5).
  assert.equal(deriveActionGateAllowed(parsed), false);
  assert.equal(isAllowed(parsed), false);
  assert.equal(actionGateDecision(parsed).allowed, false);

  // The proxy gate persists no permit boolean.
  for (const field of FORBIDDEN_PERMIT_FIELDS) {
    assert.ok(!(field in gate), `proxy-gate buildGate must not persist a '${field}' field`);
  }
});
