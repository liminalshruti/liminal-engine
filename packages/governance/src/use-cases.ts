/**
 * Governance use cases — the application layer that drives the loop
 * (observe → detect → correct → enforce → audit → improve) over the ports in
 * ./ports.ts. Pure-domain decisions come from @liminal-engine/engine-core; this
 * layer orchestrates them and threads contracts through the stores.
 *
 * Determinism: IDs + timestamps are INJECTED (idGen / clock), never Date.now()
 * or Math.random(). On the demo spine the composition root injects generators
 * that reproduce the locked Acme fixture values; tests inject their own.
 *
 * Boundary: imports contracts + engine-core + ./ports only — never a concrete
 * adapter (enforced by .dependency-cruiser.cjs).
 */
import type {
  GovernanceCase,
  EnforcementAction,
  AuditEvent,
  ActionGate,
  ActionGateDecision,
  EvalCase,
  EvalResult,
  DealStatus,
} from "@liminal-engine/contracts";
import { enforceCorrection as pureEnforceCorrection } from "@liminal-engine/engine-core";
import type {
  AgentOutputSource,
  GovernanceCaseStore,
  AuditSink,
  ActionGateStore,
  EvalStore,
} from "./ports.ts";

/** Deterministic sources of identity + time, injected at the composition root. */
export interface Clock {
  now(): string;
}
export interface IdGen {
  next(): string;
}

/** The locked deciding role — never an invented persona name (DEMO_CONTRACT). */
const DECIDING_ROLE = "VP Ops / Head of AI Transformation";

const REQUIRED_BEFORE_CUSTOMER_UPDATE = [
  "Propagate the EU data residency requirement into the Acme workstream.",
  "Assign Product, Security, and Engineering owners.",
  "Pass the EU data residency EvalCase.",
] as const;

/**
 * detect — read a pass of agent output; if it silently dropped a requirement,
 * open a blocking GovernanceCase. Returns the case, or null if nothing missed.
 * [must-not-cut #2]
 */
export async function detectMiss(
  source: AgentOutputSource,
  caseStore: GovernanceCaseStore,
  dealId: string,
  passNumber: number,
  clock: Clock,
  idGen: IdGen,
): Promise<GovernanceCase | null> {
  const output = await source.getOutput(dealId, passNumber);
  const missed = output.droppedRequirements[0];
  if (!missed) return null;

  const governanceCase: GovernanceCase = {
    id: idGen.next(),
    dealId,
    missedRequirement: missed,
    category: "data-governance",
    severity: "blocking",
    status: "open",
    detectedAt: clock.now(),
  };
  await caseStore.open(governanceCase);
  return governanceCase;
}

export interface EnforceDeps {
  auditSink: AuditSink;
  clock: Clock;
  idGen: IdGen;
}

/** Deterministic sources of identity + time only (no I/O ports). */
export interface IdentityClock {
  clock: Clock;
  idGen: IdGen;
}

/**
 * buildEnforcement — construct the EnforcementAction + AuditEvent for a
 * correction WITHOUT persisting anything. Consumes the idGen twice (action,
 * audit) and the clock twice (enforcedAt, recordedAt) in that fixed order, and
 * throws (via the pure engine-core state machine) when there is nothing to
 * enforce. Separated from persistence so a caller can order side effects for
 * fail-safety while keeping the deterministic id/timestamp assignment stable.
 */
export function buildEnforcement(
  caseId: string,
  dealId: string,
  currentStatus: DealStatus,
  gen: IdentityClock,
): { action: EnforcementAction; audit: AuditEvent } {
  const flip = pureEnforceCorrection(currentStatus);
  if (!flip.ok) throw new Error(flip.error);
  const newStatus = flip.value;

  const action: EnforcementAction = {
    id: gen.idGen.next(),
    caseId,
    dealId,
    fromStatus: currentStatus,
    toStatus: newStatus,
    actor: DECIDING_ROLE,
    enforcedAt: gen.clock.now(),
  };

  const audit: AuditEvent = {
    id: gen.idGen.next(),
    caseId,
    dealId,
    action: "correction-enforced",
    decidingActor: DECIDING_ROLE,
    previousStatus: currentStatus,
    newStatus,
    recordedAt: gen.clock.now(),
  };

  return { action, audit };
}

/**
 * enforce — the operator's Approve + Enforce. Uses the pure engine-core state
 * machine to flip the deal status, emits an EnforcementAction, and records an
 * AuditEvent capturing the correction + deciding actor. [must-not-cut #3, #6]
 *
 * (engine-core's pure enforceCorrection is imported as pureEnforceCorrection to
 * avoid shadowing this orchestrator of the same name.)
 */
export async function enforceCorrection(
  caseId: string,
  dealId: string,
  currentStatus: DealStatus,
  deps: EnforceDeps,
): Promise<{ action: EnforcementAction; audit: AuditEvent }> {
  const { action, audit } = buildEnforcement(caseId, dealId, currentStatus, {
    clock: deps.clock,
    idGen: deps.idGen,
  });
  await deps.auditSink.record(audit);
  return { action, audit };
}

/**
 * buildGate — construct the deny ActionGate for a downstream action WITHOUT
 * persisting it. Consumes the idGen once (gate id). Separated from persistence
 * so a caller can open the gate before other side effects (fail-closed).
 */
export function buildGate(
  action: string,
  caseId: string,
  idGen: IdGen,
): ActionGate {
  return {
    id: idGen.next(),
    caseId,
    action,
    verdict: "deny",
    reasons: [
      `Open governance case ${caseId} requires EU data residency correction before a customer-facing on-track update.`,
    ],
    requiredBeforeSend: [...REQUIRED_BEFORE_CUSTOMER_UPDATE],
  };
}

/**
 * enforce (gate) — block a downstream customer-facing action until the case is
 * corrected. [must-not-cut #5]
 */
export async function gateDownstreamAction(
  actionGateStore: ActionGateStore,
  action: string,
  caseId: string,
  idGen: IdGen,
): Promise<ActionGate> {
  const gate = buildGate(action, caseId, idGen);
  await actionGateStore.gate(gate);
  return gate;
}

export async function evaluateDownstreamAction(
  actionGateStore: ActionGateStore,
  action: string,
): Promise<ActionGateDecision> {
  try {
    return await actionGateStore.decisionFor(action);
  } catch (error) {
    const detail = error instanceof Error && error.message.length > 0
      ? `: ${error.message}`
      : "";
    return {
      allowed: false,
      reasons: [`Gate evaluation failed closed${detail}.`],
      requiredBeforeSend: [
        "Resolve the gate evaluation failure before sending a customer-facing update.",
      ],
    };
  }
}

export interface GovernanceLoopDeps {
  source: AgentOutputSource;
  caseStore: GovernanceCaseStore;
  auditSink: AuditSink;
  actionGateStore: ActionGateStore;
  evalStore: EvalStore;
  clock: Clock;
  idGen: IdGen;
}

/** The downstream action gated on the demo spine. */
export const GATED_CUSTOMER_ACTION = "Send customer-facing status update to Acme";

/**
 * The full loop: observe → detect → correct → enforce → audit → improve.
 * Detects the miss, enforces the flip + audit, gates the bad action, generates
 * the EvalCase, grades both passes, and records the results to the EvalStore
 * (read back by eval-harness.runEvals). Returns the EvalCase + the two results.
 * [must-not-cut #2/#3/#5/#6/#7]
 */
export async function runGovernanceLoop(
  deps: GovernanceLoopDeps,
  dealId: string,
): Promise<{ evalCase: EvalCase; evals: EvalResult[] }> {
  // detect
  const governanceCase = await detectMiss(
    deps.source,
    deps.caseStore,
    dealId,
    1,
    deps.clock,
    deps.idGen,
  );
  if (!governanceCase) {
    throw new Error(`no governance case detected for deal ${dealId}`);
  }

  // enforce + audit
  await enforceCorrection(governanceCase.id, dealId, "on-track", {
    auditSink: deps.auditSink,
    clock: deps.clock,
    idGen: deps.idGen,
  });

  // gate the downstream action
  await gateDownstreamAction(
    deps.actionGateStore,
    GATED_CUSTOMER_ACTION,
    governanceCase.id,
    deps.idGen,
  );

  // improve — the EvalCase the second pass is graded against
  const criterion = `${governanceCase.missedRequirement} requirement honored`;
  const evalCase: EvalCase = {
    id: deps.idGen.next(),
    dealId,
    governanceCaseId: governanceCase.id,
    criterion,
    createdAt: deps.clock.now(),
  };

  // grade each pass against the criterion: a pass FAILS iff it still drops the
  // requirement. Pass 1 (false green) fails; pass 2 (corrected) passes.
  const evals: EvalResult[] = [];
  for (const passNumber of [1, 2]) {
    const output = await deps.source.getOutput(dealId, passNumber);
    const honored = !output.droppedRequirements.includes(
      governanceCase.missedRequirement,
    );
    const result: EvalResult = {
      id: deps.idGen.next(),
      dealId,
      evalCaseId: evalCase.id,
      passNumber,
      criterion,
      result: honored ? "pass" : "fail",
    };
    await deps.evalStore.record(result);
    evals.push(result);
  }

  return { evalCase, evals };
}
