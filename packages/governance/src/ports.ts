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
  JsonObject,
  LinearRemediationIssuePayload,
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

/** A created (or, in dry-run, would-be-created) remediation issue reference. */
export interface RemediationIssueRef {
  /** the provider issue id (live) — never present in dry-run. */
  readonly id: string;
  /** the provider human identifier, e.g. "ENG-123" (live only). */
  readonly identifier?: string;
  /** the issue URL (live only). */
  readonly url?: string;
  readonly title: string;
}

/** The outcome of filing ONE remediation issue through the client port. */
export interface RemediationIssueResult {
  /** `dry-run` printed the payload without writing; `live` created a real issue. */
  readonly mode: "dry-run" | "live";
  /** the exact governance payload that was filed. */
  readonly payload: LinearRemediationIssuePayload;
  /**
   * the exact provider request that was sent (live) or would be sent (dry-run) —
   * a generic JsonObject so the application port carries no provider SDK types.
   * This is the "exact Linear payload" a dry-run prints byte-for-byte.
   */
  readonly providerRequest: JsonObject;
  /** the created issue — present ONLY in live mode. */
  readonly created?: RemediationIssueRef;
}

/**
 * RemediationIssueClient — the outbound port the remediation use case files
 * issues through. The live Linear adapter (packages/integrations/linear) and its
 * dry-run mode both implement it; the application never imports the concrete
 * adapter (composition-root wiring only). Mirrors the LinearWorkstreamPanel
 * boundary: dry-run/simulated by default, live only when explicitly opted in.
 */
export interface RemediationIssueClient {
  create(payload: LinearRemediationIssuePayload): Promise<RemediationIssueResult>;
}
