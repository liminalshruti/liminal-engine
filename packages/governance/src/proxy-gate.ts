/**
 * proxy-gate — the "enforce" phase's downstream gate. Blocks a customer-facing
 * action (e.g. "send on-track update") until the governance case is corrected,
 * and evaluates a gate FAIL-CLOSED: if the store throws, deny. [must-not-cut #5]
 *
 * «gov-proxy» (LIM-1230) owns the fail-closed verdict semantics here.
 */
import type { ActionGate, ActionGateDecision } from "@liminal-engine/contracts";
import type { ActionGateStore } from "./ports.ts";
import type { IdGen } from "./detect-miss.ts";

/** The downstream action gated on the demo spine. */
export const GATED_CUSTOMER_ACTION = "Send customer-facing status update to Acme";

const REQUIRED_BEFORE_CUSTOMER_UPDATE = [
  "Propagate the EU data residency requirement into the Acme workstream.",
  "Assign Product, Security, and Engineering owners.",
  "Pass the EU data residency EvalCase.",
] as const;

/**
 * buildGate — construct the deny ActionGate for a downstream action WITHOUT
 * persisting it. Consumes the idGen once (gate id). Separated from persistence
 * so a caller can open the gate before other side effects (fail-closed).
 */
export function buildGate(action: string, caseId: string, idGen: IdGen): ActionGate {
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

/** Block a downstream customer-facing action until the case is corrected. */
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

/** Evaluate whether a downstream action may proceed — FAIL-CLOSED on error. */
export async function evaluateDownstreamAction(
  actionGateStore: ActionGateStore,
  action: string,
): Promise<ActionGateDecision> {
  try {
    return await actionGateStore.decisionFor(action);
  } catch (error) {
    const detail =
      error instanceof Error && error.message.length > 0 ? `: ${error.message}` : "";
    return {
      allowed: false,
      reasons: [`Gate evaluation failed closed${detail}.`],
      requiredBeforeSend: [
        "Resolve the gate evaluation failure before sending a customer-facing update.",
      ],
    };
  }
}
