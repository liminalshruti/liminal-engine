/**
 * Ports (outbound interfaces) the governance use cases depend on. Adapters in
 * packages/integrations/* (fixture stubs first) implement these. The application
 * never imports a concrete adapter — it takes a port (enforced by boundary lint).
 */
import type {
  AgentOutput,
  GovernanceCase,
  AuditEvent,
  ActionGate,
  ActionGateDecision,
  EvalResult,
} from "@liminal-engine/contracts";

/** Source of agent output for a deal+pass (fixture stub, or live Gemini later). */
export interface AgentOutputSource {
  getOutput(dealId: string, passNumber: number): Promise<AgentOutput>;
}

export interface GovernanceCaseStore {
  open(governanceCase: GovernanceCase): Promise<void>;
  correct(caseId: string): Promise<void>;
  byDeal(dealId: string): Promise<GovernanceCase[]>;
}

/** Append-only audit evidence sink (ports onto anchor-receipt; fixture stub first). */
export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
  all(): Promise<AuditEvent[]>;
}

export interface ActionGateStore {
  gate(gate: ActionGate): Promise<void>;
  decisionFor(action: string): Promise<ActionGateDecision>;
}

export interface EvalStore {
  record(result: EvalResult): Promise<void>;
  byDeal(dealId: string): Promise<EvalResult[]>;
}

/** Simulated Linear workstream panel (DEMO_CONTRACT cut-if-risky: simulated, not live). */
export interface LinearWorkstreamPanel {
  workstreams(dealId: string): Promise<{ title: string; status: string; owner: string }[]>;
  /** Owners the workstream requires (Product / Security / Engineering) — must-not-cut #4. */
  requiredOwners(): readonly string[];
}
