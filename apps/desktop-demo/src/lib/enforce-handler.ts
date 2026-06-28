/**
 * Enforce handler — the desktop-demo composition root for the operator's
 * "Approve + Enforce" action (DEMO_CONTRACT beat #6, LIM-1169).
 *
 * The demo-spine app may NOT import packages/integrations/* — the
 * `demo-app-no-live-integrations` boundary rule keeps the spine on fixtures with
 * no live calls. So this composition root provides its OWN in-memory port
 * adapters + a deterministic Clock/IdGen, then runs the REAL governance
 * `approveAndEnforce` use case over them. The decision logic (status flip via
 * engine-core, audit record, gate verdict) is the real application/domain code;
 * this file only injects deterministic identity/time — seeded from the locked
 * Acme fixtures (the demo input, single source) — and wires the ports. No
 * Date.now()/randomness, so re-running reproduces the same result.
 *
 * (The in-memory adapters here mirror packages/integrations/{audit-sink,
 * action-gate-store,fixture-determinism}; they are re-stated in the composition
 * root rather than imported because the spine boundary forbids that import.)
 */
import {
  approveAndEnforce,
  GATED_CUSTOMER_ACTION,
  type ApproveAndEnforceResult,
  type AuditSink,
  type ActionGateStore,
  type Clock,
  type IdGen,
} from "@liminal-engine/governance";
import {
  actionGateDecision,
  type ActionGateDecision,
  type AuditEvent,
  type ActionGate,
} from "@liminal-engine/contracts";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";

/** In-memory audit sink — append-only, no I/O. Implements the governance port. */
class InMemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];
  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
  async all(): Promise<AuditEvent[]> {
    return [...this.events];
  }
}

/** In-memory action-gate store — tracks which downstream actions are gated. */
class InMemoryActionGateStore implements ActionGateStore {
  private readonly gates = new Map<string, ActionGate>();
  async gate(gate: ActionGate): Promise<void> {
    this.gates.set(gate.id, gate);
  }
  async decisionFor(action: string): Promise<ActionGateDecision> {
    for (const g of this.gates.values()) {
      const decision = actionGateDecision(g);
      // a denied gate ⇒ the action is blocked; return why + what's required
      if (g.action === action && !decision.allowed) return decision;
    }
    return { allowed: true, reasons: [], requiredBeforeSend: [] };
  }
}

/** A deterministic generator over a fixed sequence; throws if drained. */
function sequence(label: string, values: readonly string[]): () => string {
  let i = 0;
  return () => {
    if (i >= values.length) {
      throw new Error(`enforce-handler ${label} exhausted at ${i} — call order drifted`);
    }
    return values[i++]!;
  };
}

/** The deal's status BEFORE enforcement — the false green (on-track). */
export const PRE_ENFORCE_STATUS = acmeScenario.agentOutputPass1.reportedStatus;

/** The downstream action the enforce handler gates. Re-exported for the UI. */
export { GATED_CUSTOMER_ACTION };

/**
 * Run the operator's Approve + Enforce on the locked Acme case. Builds fresh
 * deterministic adapters each call (so it is replayable on the spine), then runs
 * the real governance enforce handler. Returns the new operating state to render:
 * the flipped status, the EnforcementAction, the AuditEvent, and the opened gate.
 */
export async function runApproveAndEnforce(): Promise<ApproveAndEnforceResult> {
  const auditSink = new InMemoryAuditSink();
  const actionGateStore = new InMemoryActionGateStore();

  // Deterministic identity/time for the ENFORCE phase, seeded from the locked
  // Acme fixtures (single source). The detect phase (gc id + 10:00) already ran
  // upstream, so the enforce handler starts at the enforcement slots:
  //   ids:   ea_acme_enforce → ae_acme_1 → ag_acme_update
  //   times: 10:04 (enforced) → 10:05 (recorded)
  const idGen: IdGen = {
    next: sequence("ids", [
      acmeScenario.enforcementAction.id,
      acmeScenario.auditEvent.id,
      acmeScenario.blockedAction.id,
    ]),
  };
  const clock: Clock = {
    now: sequence("times", [
      acmeScenario.enforcementAction.enforcedAt,
      acmeScenario.auditEvent.recordedAt,
    ]),
  };

  return approveAndEnforce(
    {
      caseId: acmeScenario.governanceCase.id,
      dealId: acmeScenario.governanceCase.dealId,
      currentStatus: PRE_ENFORCE_STATUS, // on-track — the false green
      gatedAction: GATED_CUSTOMER_ACTION,
    },
    { auditSink, actionGateStore, clock, idGen },
  );
}
