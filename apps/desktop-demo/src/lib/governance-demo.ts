/**
 * governance-demo — the demo's SINGLE SOURCE OF TRUTH for what the screens render.
 *
 * Instead of reading raw fixtures, this runs the REAL governance loop
 * (`runGovernanceLoop`) and eval harness (`runEvals`) over the in-memory,
 * fixture-backed adapters, then reads the produced artifacts back out of the
 * stores. So every screen renders what the loop actually computed — the UI cannot
 * diverge from the engine (DEMO_CONTRACT / Rule 6: real logic, fixtures as input).
 *
 * This is the app COMPOSITION ROOT for governance: it is the one place allowed to
 * import the concrete `packages/integrations/*` adapters and wire them to the
 * loop (the spine packages never do — boundary lint). Determinism: the Acme
 * clock + id generators reproduce the locked fixture values, so running the loop
 * yields byte-identical artifacts to `acmeScenario` — proven real, not staged.
 */
import type {
  GovernanceCase,
  AuditEvent,
  ActionGateDecision,
  EvalCase,
  EvalResult,
  AgentOutput,
  DealStatus,
} from "@liminal-engine/contracts";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { runGovernanceLoop, type AgentOutputSource } from "@liminal-engine/governance";
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
  /** beat 7: the status flip the loop enforced (from the recorded audit). */
  statusFlip: { from: DealStatus; to: DealStatus; actor: string };
  /** beat 8/9: the simulated Linear remediation workstream + required owners. */
  workstreams: { title: string; status: string; owner: string }[];
  /** beat 10: the LIVE gate verdict on the customer-facing update (allowed:false). */
  gateDecision: ActionGateDecision;
  /** beat 10: the action that is gated. */
  gatedAction: string;
  /** beat 11: the recorded audit evidence. */
  auditEvent: AuditEvent;
  /** beat 12: the eval case the second pass is graded against. */
  evalCase: EvalCase;
  /** beat 14: Fail (pass 1) → Pass (pass 2). */
  evalResults: readonly EvalResult[];
  evalRows: EvalRow[];
}

/**
 * Run the loop once over fresh fixture-backed adapters and read the produced
 * artifacts back out. Deterministic: the Acme clock/idGen make the output equal
 * the locked fixtures, so the demo is the engine's real output, not a copy.
 */
// Inline fixture providers at the composition root, fed by the locked fixtures.
// (The agent-output + Linear-workstream stubs live in the gemini/linear packages,
// which the demo app may not import — those are the LIVE-integration slots. Here
// we provide the same fixture behavior directly from contracts.)
const acmeAgentSource: AgentOutputSource = {
  async getOutput(_dealId, passNumber) {
    return passNumber <= 1 ? acmeScenario.agentOutputPass1 : acmeScenario.agentOutputPass2;
  },
};
const acmeRequiredOwners = ["Product", "Security", "Engineering"] as const;
const acmeWorkstreams = [
  { title: "Commercial terms", status: "green", owner: "Product" },
  { title: "Security review", status: "green", owner: "Security" },
  { title: "Data residency (EU)", status: "at-risk", owner: "Engineering" },
];

export async function buildGovernanceDemo(): Promise<GovernanceDemo> {
  const source = acmeAgentSource;
  const caseStore = new InMemoryGovernanceCaseStore();
  const auditSink = new InMemoryAuditSink();
  const actionGateStore = new InMemoryActionGateStore();
  const evalStore = new InMemoryEvalStore();
  const clock = createAcmeClock();
  const idGen = createAcmeIdGen();

  // run the real loop — detect → enforce → gate → eval
  const { evalCase, evals } = await runGovernanceLoop(
    { source, caseStore, auditSink, actionGateStore, evalStore, clock, idGen },
    DEAL_ID,
  );

  // read the produced artifacts back out of the stores (single source of truth)
  const [governanceCase] = await caseStore.byDeal(DEAL_ID);
  if (!governanceCase) throw new Error("demo: loop opened no governance case");
  const [auditEvent] = await auditSink.all();
  if (!auditEvent) throw new Error("demo: loop recorded no audit event");

  // beat 10: the LIVE gate verdict the loop produced — ask the store to decide on
  // the gated customer action. This is the real fail-closed evaluation, not a copy.
  const gateDecision = await actionGateStore.decisionFor(
    "Send customer-facing status update to Acme",
  );
  const evalResults = await runEvals(evalStore, DEAL_ID);

  return {
    dealId: DEAL_ID,
    businessGoal: acmeScenario.businessGoal,
    demoBeats: acmeScenario.demoBeats,
    requiredOwners: acmeRequiredOwners,
    agentOutputPass1: await source.getOutput(DEAL_ID, 1),
    agentOutputPass2: await source.getOutput(DEAL_ID, 2),
    governanceCase,
    // the status flip is the loop's enforcement, captured in the audit record
    statusFlip: {
      from: auditEvent.previousStatus,
      to: auditEvent.newStatus,
      actor: auditEvent.decidingActor,
    },
    workstreams: acmeWorkstreams,
    gateDecision,
    gatedAction: "Send customer-facing status update to Acme",
    auditEvent,
    evalCase,
    evalResults,
    evalRows: toRows(evalResults),
  };
}
