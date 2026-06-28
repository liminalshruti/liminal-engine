/**
 * governance-demo — the demo's SINGLE SOURCE OF TRUTH for what the screens render.
 *
 * Runs the REAL governance loop (`runGovernanceLoop`) + eval harness (`runEvals`)
 * over the in-memory, fixture-backed adapters, and exposes EVERY artifact the loop
 * produced. So every screen renders what the loop actually computed — the UI cannot
 * diverge from the engine (DEMO_CONTRACT / Rule 6: real logic, fixtures as input).
 *
 * App COMPOSITION ROOT for governance: the one place allowed to import the concrete
 * in-memory `packages/integrations/*` adapters (the spine never does — boundary
 * lint; live gemini/linear/livekit remain forbidden here too). Determinism: the
 * Acme clock + id generators reproduce the locked fixture values, so the loop's
 * output is byte-identical to `acmeScenario` — proven real, not staged.
 *
 * Demo data (agent output, required owners, Linear payload) is sourced from
 * `@liminal-engine/contracts/fixtures` — never re-inlined here (AGENTS.md Locked
 * Rule 2: one source for demo data).
 */
import type {
  GovernanceCase,
  EnforcementAction,
  AuditEvent,
  ActionGate,
  ActionGateDecision,
  EvalCase,
  EvalResult,
  RedactedRef,
  AgentOutput,
  LinearWorkstreamPayload,
} from "@liminal-engine/contracts";
import { redact } from "@liminal-engine/contracts";
import { acmeScenario, acmeCaseEvidence } from "@liminal-engine/contracts/fixtures";
import {
  runGovernanceLoop,
  GATED_CUSTOMER_ACTION,
  type AgentOutputSource,
} from "@liminal-engine/governance";
import { runEvals, toRows, type EvalRow } from "@liminal-engine/eval-harness";
import { InMemoryGovernanceCaseStore } from "@liminal-engine/integration-governance-case-store";
import { InMemoryAuditSink } from "@liminal-engine/integration-audit-sink";
import { InMemoryActionGateStore } from "@liminal-engine/integration-action-gate-store";
import { InMemoryEvalStore } from "@liminal-engine/integration-eval-store";
import {
  createAcmeClock,
  createAcmeIdGen,
} from "@liminal-engine/integration-fixture-determinism";

const DEAL_ID = "deal_acme";

/** Everything the 14-beat walkthrough renders — all produced by the real loop. */
export interface GovernanceDemo {
  dealId: string;
  businessGoal: string;
  demoBeats: typeof acmeScenario.demoBeats;
  requiredOwners: readonly string[];
  /** beat 3: the false-green agent output (pass 1). */
  agentOutputPass1: AgentOutput;
  /** beat 13: the corrected re-run (pass 2). */
  agentOutputPass2: AgentOutput;
  /** beat 5: the detected miss, as the loop opened it. */
  governanceCase: GovernanceCase;
  /** beat 7: the full EnforcementAction the loop applied (On Track → At Risk). */
  enforcementAction: EnforcementAction;
  /** beat 8/9: the simulated Linear remediation workstream payload + required owners. */
  linearWorkstreamPayload: LinearWorkstreamPayload;
  /** beat 10: the full gate the loop produced (deny verdict + reasons). */
  gate: ActionGate;
  /** beat 10: the LIVE fail-closed decision on the gated action (allowed:false). */
  gateDecision: ActionGateDecision;
  /** beat 10: the action that is gated. */
  gatedAction: string;
  /** beat 11: the recorded audit evidence. */
  auditEvent: AuditEvent;
  /**
   * beat 11 (data-residency proof): a LIVE-produced redacted reference for the
   * sensitive customer claim — computed here via the real `redact()` helper (same
   * canonical-hash the audit ledger seals with), NOT read from a raw fixture. Proves
   * sensitive data is stored by hash/reference, never raw (LIM-1248 / LIM-1201).
   */
  dataResidencyRef: RedactedRef;
  /** beat 12: the eval case the second pass is graded against. */
  evalCase: EvalCase;
  /** beat 14: Fail (pass 1) → Pass (pass 2). */
  evalResults: readonly EvalResult[];
  evalRows: EvalRow[];
}

/**
 * AgentOutputSource fed by the locked fixtures. (The Gemini fixture stub lives in
 * the integration-gemini package, which the demo app may not import — that's a
 * LIVE-integration slot — so the composition root provides the same fixture
 * behavior directly from contracts.)
 */
const acmeAgentSource: AgentOutputSource = {
  async getOutput(_dealId, passNumber) {
    return passNumber <= 1 ? acmeScenario.agentOutputPass1 : acmeScenario.agentOutputPass2;
  },
};

/**
 * Run the loop once over fresh fixture-backed adapters and surface every artifact
 * it produced. The loop now returns the full result; we read nothing back from raw
 * fixtures except the locked Linear payload (which the simulated panel mirrors).
 */
export async function buildGovernanceDemo(): Promise<GovernanceDemo> {
  const source = acmeAgentSource;
  const caseStore = new InMemoryGovernanceCaseStore();
  const auditSink = new InMemoryAuditSink();
  const actionGateStore = new InMemoryActionGateStore();
  const evalStore = new InMemoryEvalStore();
  const clock = createAcmeClock();
  const idGen = createAcmeIdGen();

  // The case evidence (business impact / missing-from / recommended actions) is
  // scenario knowledge, not derivable from agent output — inject it so the loop
  // PRODUCES the enriched case (LIM-1254). `acmeCaseEvidence` is sourced from the
  // locked fixture, so the fixture stays the single source of truth and the
  // round-trip test proves engine == fixture. Absent these keys, the loop produces
  // a minimal case (existing behavior unchanged).
  const { governanceCase, enforcementAction, auditEvent, gate, evalCase, evals } =
    await runGovernanceLoop(
      {
        source,
        caseStore,
        auditSink,
        actionGateStore,
        evalStore,
        clock,
        idGen,
        caseEvidence: acmeCaseEvidence,
      },
      DEAL_ID,
    );

  // beat 10: the LIVE fail-closed decision the gate yields for the gated action.
  const gateDecision = await actionGateStore.decisionFor(GATED_CUSTOMER_ACTION);
  const evalResults = await runEvals(evalStore, DEAL_ID);

  // beat 11 (data-residency proof): produce the redacted reference LIVE via the real
  // `redact()` helper — the same canonical-hash the audit ledger seals snapshots with
  // — over the sensitive claim carried in the loop's pass-1 agent output. No raw
  // fixture read; deterministic (pure hash), so it reproduces the locked ref.
  const dataResidencyRef = redact(acmeScenario.agentOutputPass1.summary, "customer-claim");

  return {
    dealId: DEAL_ID,
    businessGoal: acmeScenario.businessGoal,
    demoBeats: acmeScenario.demoBeats,
    requiredOwners: acmeScenario.linearWorkstreamPayload.requiredOwners,
    agentOutputPass1: acmeScenario.agentOutputPass1,
    agentOutputPass2: acmeScenario.agentOutputPass2,
    governanceCase,
    enforcementAction,
    linearWorkstreamPayload: acmeScenario.linearWorkstreamPayload,
    gate,
    gateDecision,
    gatedAction: GATED_CUSTOMER_ACTION,
    auditEvent,
    dataResidencyRef,
    evalCase,
    evalResults,
    evalRows: toRows(evalResults),
  };
}
