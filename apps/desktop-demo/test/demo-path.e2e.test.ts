/**
 * End-to-end click-through of the 14-step required demo path (LIM-1240).
 *
 * Walks the LOCKED DEMO_CONTRACT path (#1–#14, MNC#1–7) in order and asserts the
 * concrete outcome each beat must put on screen — driving the REAL engine end to
 * end and tying every live artifact to the data the merged screens render. It is
 * the demo's safety net: if any covered beat breaks, the matching `beat #N` test
 * fails and names the beat.
 *
 * WHY THIS LAYER (not a rendered DOM walk). The repo's test runner is
 * `node --test` over `*.test.ts` (see package.json). Node strips TS types but does
 * NOT transform JSX, so a test cannot import any `.tsx` (screens / components /
 * steps.tsx / App.tsx) — verified: `ERR_UNKNOWN_FILE_EXTENSION ".tsx"`. So, exactly
 * like the determinism test this issue is told to match
 * (packages/governance/src/determinism.test.ts, LIM-1241), the click-through is
 * driven at the layer node can execute:
 *   - the REAL governance engine — `runGovernanceLoop` (observe→detect→correct→
 *     enforce→audit→improve) + `runEvals` (the Fail→Pass table), over in-memory
 *     port adapters + an injected deterministic Clock/IdGen (no Date.now /
 *     randomness — the spine can't flake on stage); and
 *   - the REAL app composition root — `runApproveAndEnforce` (apps/desktop-demo/
 *     src/lib/enforce-handler.ts), the handler the Approve + Enforce button triggers
 *     at beat #6. Driving it is the genuine "click".
 * Each beat then asserts the live outcome against the JSX-free data/copy the merged
 * screen actually renders (acmeScenario fixtures, SCREEN_COPY, the eval-harness
 * row/model helpers, the ui-components view-model helpers). The fixtures are the
 * required demo INPUT (DEMO_CONTRACT / AGENTS.md Rule 5); the counts, status flip,
 * deny, audit, EvalCase and Fail→Pass are REAL computed output.
 *
 * Test harness (in-memory ports + deterministic generators). The adapters below are
 * RE-STATED in the test rather than imported from packages/integrations/* — mirroring
 * apps/desktop-demo/src/lib/enforce-handler.ts, which re-states them in the app
 * composition root because the demo-spine app deliberately does not depend on the
 * integration packages (`demo-app-no-live-integrations`). They are the standard
 * in-memory port implementations (maps/arrays) the integration FIXTURE STUBS also
 * use; the ENGINE computation they are passed to is the real thing. The Clock/IdGen
 * are seeded ONLY from `acmeScenario` (the LIM-1165 single source), so the test data
 * can never silently drift from the demo fixtures, and they throw if drained — which
 * also pins the loop's id/timestamp call order.
 *
 * SCOPE NOTE (beats #4–#5). Beat #4's screen (ContextTray) and beat #5's screen
 * (GovernanceCase / MNC#2; LIM-1218, merged in #43) are both on main and covered.
 * Beat #5 is asserted at two layers: the ENGINE side (the GovernanceCase the loop
 * opens) AND the SCREEN's JSX-free render data — the `caseHeadline()` view-model
 * helper and `SCREEN_COPY.governanceCase` the merged screen renders (AGENTS.md
 * "two barrels"). The screen's actual JSX/DOM is not walked here only because
 * `node --test` cannot import `.tsx` (see WHY THIS LAYER above), the same constraint
 * that applies to every other beat in this file.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { acmeScenario, acmeCaseEvidence } from "@liminal-engine/contracts/fixtures";
import { canonicalHash, isAllowed, actionGateDecision } from "@liminal-engine/contracts";
import type {
  AgentOutput,
  GovernanceCase,
  AuditEvent,
  ActionGate,
  ActionGateDecision,
  EvalResult,
} from "@liminal-engine/contracts";
import {
  runGovernanceLoop,
  evaluateDownstreamAction,
  GATED_CUSTOMER_ACTION,
} from "@liminal-engine/governance";
import type {
  AgentOutputSource,
  GovernanceCaseStore,
  AuditSink,
  ActionGateStore,
  EvalStore,
  Clock,
  IdGen,
} from "@liminal-engine/governance";
import { runEvals, toRows } from "@liminal-engine/eval-harness";
import { falseGreenBanner, caseHeadline } from "@liminal-engine/ui-components";

import { runApproveAndEnforce, PRE_ENFORCE_STATUS } from "../src/lib/enforce-handler.ts";
import { OPERATOR_ROLE, SCREEN_COPY } from "../src/lib/copy.ts";
import { toBeforeAfterCheckRows } from "../src/screens/SecondPassEval.model.ts";

const DEAL = "deal_acme";
/** A plausible non-gated action — proves the deny is specific, not a blanket block. */
const UNRELATED_ACTION = "Send internal status note";
const DECIDING_ROLE = "VP Ops / Head of AI Transformation";

// --- Test harness: in-memory port adapters (re-stated; see file header) ----------

class InMemoryGovernanceCaseStore implements GovernanceCaseStore {
  private readonly cases = new Map<string, GovernanceCase>();
  async open(governanceCase: GovernanceCase): Promise<void> {
    this.cases.set(governanceCase.id, governanceCase);
  }
  async correct(caseId: string): Promise<void> {
    const c = this.cases.get(caseId);
    if (c) this.cases.set(caseId, { ...c, status: "corrected" });
  }
  async byDeal(dealId: string): Promise<GovernanceCase[]> {
    return [...this.cases.values()].filter((c) => c.dealId === dealId);
  }
}

class InMemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];
  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
  async all(): Promise<AuditEvent[]> {
    return [...this.events];
  }
}

class InMemoryActionGateStore implements ActionGateStore {
  private readonly gates = new Map<string, ActionGate>();
  async gate(gate: ActionGate): Promise<void> {
    this.gates.set(gate.id, gate);
  }
  async decisionFor(action: string): Promise<ActionGateDecision> {
    for (const g of this.gates.values()) {
      const decision = actionGateDecision(g);
      if (g.action === action && !decision.allowed) return decision;
    }
    return { allowed: true, reasons: [], requiredBeforeSend: [] };
  }
}

class InMemoryEvalStore implements EvalStore {
  private readonly results = new Map<string, EvalResult>();
  async record(result: EvalResult): Promise<void> {
    this.results.set(result.id, result);
  }
  async byDeal(dealId: string): Promise<EvalResult[]> {
    return [...this.results.values()].filter((r) => r.dealId === dealId);
  }
}

/** Observe source — the fixture agent output per pass (pass 1 false green, pass 2 corrected). */
class FixtureAgentOutputSource implements AgentOutputSource {
  async getOutput(_dealId: string, passNumber: number): Promise<AgentOutput> {
    return passNumber <= 1 ? acmeScenario.agentOutputPass1 : acmeScenario.agentOutputPass2;
  }
}

/** Deterministic generator over a fixed sequence; throws if drained (call-order drift). */
function sequence(label: string, values: readonly string[]): () => string {
  let i = 0;
  return () => {
    if (i >= values.length) {
      throw new Error(`demo-path ${label} exhausted at ${i} — loop call order drifted`);
    }
    return values[i++]!;
  };
}

// IDs + timestamps the full loop consumes, in order — seeded ONLY from the locked
// Acme fixtures (single source), so the injected generators reproduce the demo data.
function createDeterministicIdGen(): IdGen {
  return {
    next: sequence("ids", [
      acmeScenario.governanceCase.id, // gc_acme_eu     (detect)
      acmeScenario.enforcementAction.id, // ea_acme_enforce (enforce)
      acmeScenario.auditEvent.id, // ae_acme_1      (audit)
      acmeScenario.blockedAction.id, // ag_acme_update (gate)
      acmeScenario.evalCase.id, // ec_acme_eu     (eval case)
      acmeScenario.evalPass1.id, // ev_acme_p1     (eval pass 1)
      acmeScenario.evalPass2.id, // ev_acme_p2     (eval pass 2)
    ]),
  };
}
function createDeterministicClock(): Clock {
  return {
    now: sequence("times", [
      acmeScenario.governanceCase.detectedAt, // 10:00 detected
      acmeScenario.enforcementAction.enforcedAt, // 10:04 enforced
      acmeScenario.auditEvent.recordedAt, // 10:05 recorded
      acmeScenario.evalCase.createdAt, // 10:06 eval case
    ]),
  };
}

/**
 * One full pass of the governance engine from clean state, returning every
 * demo-visible artifact the 14-beat walk asserts. Mirrors determinism.test.ts's
 * `runOnce`, extended with the eval-harness read side (`runEvals` → the table the
 * SecondPassEval screen renders) and a control (allowed) gate decision.
 */
async function runGovernanceEngine() {
  const deps = {
    source: new FixtureAgentOutputSource(),
    caseStore: new InMemoryGovernanceCaseStore(),
    auditSink: new InMemoryAuditSink(),
    actionGateStore: new InMemoryActionGateStore(),
    evalStore: new InMemoryEvalStore(),
    clock: createDeterministicClock(),
    idGen: createDeterministicIdGen(),
    // inject the locked case evidence so the loop produces the ENRICHED case
    // (LIM-1254) — the beat-#5 round-trip below asserts engine output == fixture.
    caseEvidence: acmeCaseEvidence,
  };

  const { evalCase, evals } = await runGovernanceLoop(deps, DEAL);

  return {
    governanceCases: await deps.caseStore.byDeal(DEAL),
    auditEvents: await deps.auditSink.all(),
    gateDecision: await evaluateDownstreamAction(deps.actionGateStore, GATED_CUSTOMER_ACTION),
    allowedDecision: await evaluateDownstreamAction(deps.actionGateStore, UNRELATED_ACTION),
    evalCase,
    evals,
    evalResults: await deps.evalStore.byDeal(DEAL),
    evalTable: await runEvals(deps.evalStore, DEAL),
  };
}

// One shared engine run + one shared enforce "click" — the e2e walks a SINGLE demo
// session, each beat asserting its slice. Memoized inside a function (not at top
// level) so a rejection is always attached to the awaiting test, never swallowed.
let engineRun: ReturnType<typeof runGovernanceEngine> | undefined;
const demoEngine = () => (engineRun ??= runGovernanceEngine());

let enforceRun: ReturnType<typeof runApproveAndEnforce> | undefined;
const demoEnforce = () => (enforceRun ??= runApproveAndEnforce());

// ---------------------------------------------------------------------------
// DEMO_CONTRACT outcomes — the issue's acceptance list, asserted crisply up front.
// ---------------------------------------------------------------------------
test("DEMO_CONTRACT outcomes — exactly 1 GovernanceCase, enforcement produced, 1 deny, 1 EvalCase, Fail→Pass", async () => {
  const engine = await demoEngine();
  const enforced = await demoEnforce();

  // exactly 1 GovernanceCase opened (MNC#2)
  assert.equal(engine.governanceCases.length, 1, "expected exactly one GovernanceCase opened for the Acme deal");
  assert.equal(engine.governanceCases[0]!.missedRequirement, "EU data residency");

  // the enforcement actions produced (MNC#3 / #6): the status flip + exactly one audit event
  assert.equal(enforced.status, "at-risk", "Approve + Enforce must flip the deal to at-risk");
  assert.equal(enforced.enforcement.fromStatus, "on-track");
  assert.equal(enforced.enforcement.toStatus, "at-risk");
  assert.equal(engine.auditEvents.length, 1, "expected exactly one AuditEvent recorded");
  assert.equal(engine.auditEvents[0]!.action, "correction-enforced");

  // 1 deny on the future customer-facing on-track action (MNC#5), and only that action
  assert.equal(enforced.gate.action, GATED_CUSTOMER_ACTION);
  assert.equal(enforced.gate.verdict, "deny");
  assert.equal(isAllowed(enforced.gate), false);
  assert.equal(engine.gateDecision.allowed, false, "the customer-facing update must be denied");
  assert.equal(engine.allowedDecision.allowed, true, "the deny must be specific to the customer action, not blanket");

  // exactly 1 EvalCase generated (beat #12), graded across both passes
  assert.equal(engine.evalCase.id, acmeScenario.evalCase.id);
  assert.equal(engine.evalResults.length, 2);
  assert.equal(new Set(engine.evalResults.map((r) => r.evalCaseId)).size, 1, "all eval results grade the one EvalCase");

  // Fail → Pass on the second pass (MNC#7)
  assert.deepEqual(engine.evals.map((e) => e.result), ["fail", "pass"]);
});

// ---------------------------------------------------------------------------
// The 14-step required path (DEMO_CONTRACT), beat by beat, in order.
// ---------------------------------------------------------------------------

test("beat #1 — Initialize workspace (observe): the governance workspace is set up for the one Acme deal", async () => {
  const engine = await demoEngine();
  // The Initialize screen frames the workspace: the deal under governance + the operator role.
  assert.equal(SCREEN_COPY.initialize.title, "Initialize governance workspace");
  assert.ok(SCREEN_COPY.initialize.intro.length > 0, "the Initialize screen has intro copy");
  assert.equal(OPERATOR_ROLE, DECIDING_ROLE); // operator is a ROLE (persona rule)
  // one consistent deal across the whole path
  assert.equal(acmeScenario.agentOutputPass1.dealName, "Acme expansion");
  assert.equal(engine.governanceCases[0]!.dealId, DEAL);
});

test("beat #2 — Show Acme business goal (observe): the locked $1.2M goal is shown", async () => {
  assert.equal(acmeScenario.businessGoal, "Close Acme expansion by Friday — $1.2M ARR");
  // Initialize renders the goal verbatim from the single-source fixture (no hardcoded copy).
  assert.equal(acmeScenario.demoBeats.goal, acmeScenario.businessGoal);
});

test("beat #3 — Show agent output / the false green (observe · MNC#1): pass-1 reads on-track while a requirement was dropped", async () => {
  const p1 = acmeScenario.agentOutputPass1;
  assert.equal(PRE_ENFORCE_STATUS, "on-track"); // the deal starts as the false green
  assert.equal(p1.reportedStatus, "on-track", "the agent falsely reports on-track");
  assert.ok(p1.droppedRequirements.length > 0, "...while silently dropping a load-bearing requirement");
  // AgentActivity renders the verbatim claim; the false-green insight is derived (ContextTray).
  assert.equal(acmeScenario.demoBeats.agentClaim, "Acme expansion appears on track");
  assert.equal(falseGreenBanner(p1).tone, "warn");
});

test("beat #4 — Reveal lost EU data-residency requirement (detect): the dropped requirement is surfaced", async () => {
  const engine = await demoEngine();
  const p1 = acmeScenario.agentOutputPass1;
  assert.ok(p1.droppedRequirements.includes("EU data residency"), "the dropped requirement is EU data residency");
  assert.equal(acmeScenario.demoBeats.droppedRequirement, "EU data residency");
  // ContextTray (merged on main) reveals it via the false-green banner copy.
  assert.match(falseGreenBanner(p1).label, /silently dropped/i);
  // tie the reveal to the detection: the case the engine opens is for this same requirement
  assert.equal(engine.governanceCases[0]!.missedRequirement, "EU data residency");
});

test("beat #5 — Surface GovernanceCase (detect · MNC#2): the loop opens exactly 1 blocking case for the dropped requirement", async () => {
  const engine = await demoEngine();
  assert.equal(engine.governanceCases.length, 1, "exactly one GovernanceCase opened");
  const gc = engine.governanceCases[0]!;
  assert.equal(gc.missedRequirement, "EU data residency");
  assert.equal(gc.severity, "blocking");
  assert.equal(gc.status, "open");
  assert.equal(gc.dealId, DEAL);
  // the live, computed case equals the locked fixture the screens are wired to
  assert.deepEqual(gc, acmeScenario.governanceCase);
});

// The GovernanceCase SCREEN (LIM-1218, merged in #43; apps/desktop-demo/AGENTS.md maps it to
// beats #4–#5, steps.tsx to beat #5) is on main. It renders the case via the caseHeadline()
// view-model helper + SCREEN_COPY.governanceCase (AGENTS.md "two barrels"). We assert against
// the same JSX-free render data here — the engine's computed case feeds the headline the
// screen shows, and the framing copy is non-empty single-source copy (no hardcoded strings).
test(
  "beat #5 (UI) — GovernanceCase screen surfaces the detected case via caseHeadline()",
  async () => {
    const engine = await demoEngine();
    const gc = engine.governanceCases[0]!;
    // the headline the screen renders is derived from the live, computed case
    assert.equal(caseHeadline(gc), "Dropped requirement: EU data residency (blocking)");
    // the screen frames the case with single-source copy, not hardcoded strings
    assert.equal(SCREEN_COPY.governanceCase.title, "Governance case");
    assert.ok(
      SCREEN_COPY.governanceCase.intro.length > 0,
      "the GovernanceCase screen has intro copy",
    );
  },
);

test("beat #6 — Operator clicks Approve + Enforce (correct): the app enforce-handler runs the real use case", async () => {
  const enforced = await demoEnforce();
  // runApproveAndEnforce is the desktop-demo composition root the Approve + Enforce button triggers.
  assert.equal(SCREEN_COPY.enforcementPanel.title, "Approve + Enforce");
  assert.equal(enforced.enforcement.caseId, acmeScenario.governanceCase.id, "the click enforces the open case");
  assert.equal(enforced.enforcement.actor, OPERATOR_ROLE, "the deciding actor is the operator role");
});

test("beat #7 — Status changes On Track → At Risk (enforce · MNC#3)", async () => {
  const enforced = await demoEnforce();
  assert.equal(enforced.enforcement.fromStatus, "on-track");
  assert.equal(enforced.enforcement.toStatus, "at-risk");
  assert.equal(enforced.status, "at-risk", "the resulting operating state is at-risk");
  // the live enforcement equals the locked fixture the EnforcementPanel StatusBadge flip renders
  assert.deepEqual(enforced.enforcement, acmeScenario.enforcementAction);
});

test("beat #8 — Simulated Linear workstream appears (enforce · MNC#4)", async () => {
  const payload = acmeScenario.linearWorkstreamPayload;
  assert.ok(payload.workstreams.length > 0, "a remediation workstream is created");
  assert.equal(payload.dealId, DEAL);
  // EnforcementPanel renders this via LinearPayloadView (labelled "Simulated").
  assert.ok(
    payload.workstreams.some((w) => /data residency/i.test(w.title)),
    "the EU data-residency workstream is present",
  );
});

test("beat #9 — Product / Security / Engineering owners required (enforce)", async () => {
  const enforced = await demoEnforce();
  assert.deepEqual([...acmeScenario.requiredOwners], ["Product", "Security", "Engineering"]);
  assert.deepEqual(acmeScenario.linearWorkstreamPayload.requiredOwners, ["Product", "Security", "Engineering"]);
  // the gate holds the customer update until those owners are assigned
  assert.ok(
    enforced.gate.requiredBeforeSend.some((r) => /Product, Security, and Engineering/i.test(r)),
    "assigning Product/Security/Engineering owners is required before send",
  );
});

test("beat #10 — False customer-facing on-track update is blocked (enforce · MNC#5): exactly 1 deny", async () => {
  const engine = await demoEngine();
  const enforced = await demoEnforce();
  // the gated action is the downstream customer-facing on-track update
  assert.equal(GATED_CUSTOMER_ACTION, "Send customer-facing status update to Acme");
  assert.equal(enforced.gate.action, GATED_CUSTOMER_ACTION);
  assert.equal(enforced.gate.verdict, "deny");
  assert.equal(isAllowed(enforced.gate), false);
  assert.ok(enforced.gate.reasons.length > 0, "the deny explains why");
  assert.match(enforced.gate.reasons[0]!, /on-track update/i);
  // the engine's gate evaluation denies that one action and allows unrelated ones (specific deny)
  assert.equal(engine.gateDecision.allowed, false);
  assert.equal(engine.allowedDecision.allowed, true);
  // the live gate equals the locked fixture the BlockedActionBanner renders
  assert.deepEqual(enforced.gate, acmeScenario.blockedAction);
});

test("beat #11 — AuditEvent recorded (audit · MNC#6): exactly 1 correction event with the deciding actor", async () => {
  const engine = await demoEngine();
  assert.equal(engine.auditEvents.length, 1, "exactly one AuditEvent recorded");
  const ae = engine.auditEvents[0]!;
  assert.equal(ae.action, "correction-enforced");
  assert.equal(ae.previousStatus, "on-track");
  assert.equal(ae.newStatus, "at-risk");
  assert.match(ae.decidingActor, /VP|Head|operator|\//i); // a ROLE, never an invented name
  // the live audit equals the locked fixture the AuditTrail TraceRow renders
  assert.deepEqual(ae, acmeScenario.auditEvent);
});

test("beat #12 — EvalCase generated (improve): exactly 1 EvalCase grades the case", async () => {
  const engine = await demoEngine();
  assert.equal(engine.evalCase.governanceCaseId, acmeScenario.governanceCase.id);
  assert.equal(engine.evalCase.criterion, "EU data residency requirement honored");
  assert.equal(new Set(engine.evalResults.map((r) => r.evalCaseId)).size, 1);
  assert.deepEqual(engine.evalCase, acmeScenario.evalCase);
});

test("beat #13 — Second pass improves (improve): the re-run honors the requirement", async () => {
  const engine = await demoEngine();
  const p2 = acmeScenario.agentOutputPass2;
  assert.deepEqual(p2.droppedRequirements, [], "nothing dropped after enforcement");
  assert.equal(p2.reportedStatus, "at-risk", "the re-run is honestly at-risk, not a false green");
  assert.equal(p2.passNumber, 2);
  // tie the improved output to the graded result: pass 2 passes BECAUSE the requirement is honored
  assert.equal(engine.evals[1]!.passNumber, 2);
  assert.equal(engine.evals[1]!.result, "pass");
});

test("beat #14 — Eval table shows Fail → Pass (improve · MNC#7)", async () => {
  const engine = await demoEngine();
  // runEvals is the eval-harness read side that renders the table; toRows is what the screen uses.
  const rows = toRows(engine.evalTable);
  assert.deepEqual(
    rows.map((r) => `pass ${r.pass}: ${r.result}`),
    ["pass 1: fail", "pass 2: pass"],
  );
  // the SecondPassEval screen's per-check model proves the flip per criterion
  const beforeAfter = toBeforeAfterCheckRows(rows);
  assert.equal(beforeAfter.length, 1);
  assert.equal(beforeAfter[0]!.criterion, "EU data residency requirement honored");
  assert.equal(beforeAfter[0]!.before.result, "fail");
  assert.equal(beforeAfter[0]!.after.result, "pass");
});

// ---------------------------------------------------------------------------
// DEMO_CONTRACT acceptance criteria that span the whole path.
// ---------------------------------------------------------------------------

test("acceptance — deterministic: re-walking the demo path produces byte-identical artifacts (canonical hash)", async () => {
  // DEMO_CONTRACT acceptance: "re-running produces the same result (no live-call flakiness on the
  // spine)". packages/governance/src/determinism.test.ts is the dedicated per-artifact guard; this
  // asserts the full demo-path bundle this e2e walks — including the runEvals table — is
  // reproducible end to end, via the same canonical hash the contract golden tests use.
  const a = await runGovernanceEngine();
  const b = await runGovernanceEngine();
  assert.equal(canonicalHash(a), canonicalHash(b), "the demo path is non-deterministic — two clean runs diverged");
});

test("acceptance — no invented persona name: the deciding actor is a ROLE everywhere on the path", async () => {
  const engine = await demoEngine();
  const enforced = await demoEnforce();
  assert.equal(OPERATOR_ROLE, DECIDING_ROLE);
  assert.equal(enforced.enforcement.actor, DECIDING_ROLE);
  assert.equal(engine.auditEvents[0]!.decidingActor, DECIDING_ROLE);
  assert.match(DECIDING_ROLE, /\//); // a role title (contains a slash) — never a bare personal name
});
