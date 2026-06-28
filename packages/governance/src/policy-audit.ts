import {
  interceptedActionContract,
  actionPolicyRuleContract,
  type ActionGateDecisionSource,
  type InterceptedAction,
  type ActionPolicyRule,
  type ActionPolicyRuleStatus,
  type ActionPolicyVerdict,
} from "@liminal-engine/contracts";
import { AuditLedger, verifyChain, type SealedAuditEvent } from "./audit-ledger.ts";
import type { Clock, IdGen } from "./detect-miss.ts";

export interface PolicyVerdictForAudit {
  verdict: ActionPolicyVerdict;
  allowed: boolean;
  reasons: readonly string[];
  requiredBeforeSend: readonly string[];
  source: ActionGateDecisionSource;
  sourceRuleId?: string;
}

export interface AppendPolicyVerdictInput {
  caseId: string;
  dealId: string;
  decidingActor: string;
  action: InterceptedAction;
  decision: PolicyVerdictForAudit;
  fromCorrectionId?: string;
}

export function appendPolicyVerdictAudit(
  ledger: AuditLedger,
  input: AppendPolicyVerdictInput,
  deps: { clock: Clock; idGen: IdGen },
): SealedAuditEvent {
  const action = interceptedActionContract.parse(input.action);
  return ledger.append({
    id: deps.idGen.next(),
    caseId: input.caseId,
    dealId: input.dealId,
    action: "policy.verdict",
    decidingActor: input.decidingActor,
    previousStatus: "at-risk",
    newStatus: "at-risk",
    recordedAt: deps.clock.now(),
    beforeState: {
      interceptedAction: action,
    },
    afterState: {
      policyVerdict: {
        verdict: input.decision.verdict,
        allowed: input.decision.allowed,
        reasons: [...input.decision.reasons],
        requiredBeforeSend: [...input.decision.requiredBeforeSend],
        source: input.decision.source,
        ...(input.decision.sourceRuleId !== undefined ? { sourceRuleId: input.decision.sourceRuleId } : {}),
        ...(input.fromCorrectionId !== undefined ? { fromCorrectionId: input.fromCorrectionId } : {}),
      },
    },
    evidenceIds: [
      action.id,
      ...(input.decision.sourceRuleId !== undefined ? [input.decision.sourceRuleId] : []),
      ...(input.fromCorrectionId !== undefined ? [input.fromCorrectionId] : []),
    ],
  });
}

export interface AppendPolicyRuleAuditInput {
  caseId: string;
  dealId: string;
  decidingActor: string;
  rule: ActionPolicyRule;
}

export function appendPolicyRuleAudit(
  ledger: AuditLedger,
  input: AppendPolicyRuleAuditInput,
  deps: { clock: Clock; idGen: IdGen },
): SealedAuditEvent {
  const rule = actionPolicyRuleContract.parse(input.rule);
  return ledger.append({
    id: deps.idGen.next(),
    caseId: input.caseId,
    dealId: input.dealId,
    action: `policy.rule.${rule.status}`,
    decidingActor: input.decidingActor,
    previousStatus: "at-risk",
    newStatus: "at-risk",
    recordedAt: deps.clock.now(),
    afterState: {
      policyRule: rule,
    },
    evidenceIds: [rule.id, rule.fromCorrectionId, rule.evalCaseId],
    evalIds: [rule.evalCaseId],
  });
}

export interface ReconstructedPolicyRuleLifecycle {
  ruleId: string;
  currentStatus: ActionPolicyRuleStatus;
  versions: ActionPolicyRule[];
  timeline: SealedAuditEvent[];
  chainValid: true;
}

export function reconstructPolicyRuleLifecycle(
  events: readonly SealedAuditEvent[],
  ruleId: string,
): ReconstructedPolicyRuleLifecycle {
  const verification = verifyChain(events);
  if (!verification.valid) {
    throw new Error(
      `cannot reconstruct policy rule: audit chain is invalid (${verification.reason ?? "broken chain"})`,
    );
  }

  const versions: ActionPolicyRule[] = [];
  const timeline: SealedAuditEvent[] = [];

  for (const event of events) {
    const rule = readPolicyRule(event.afterState);
    if (rule === null) continue;
    if (rule.id === ruleId || rule.supersedesId === ruleId) {
      versions.push(rule);
      timeline.push(event);
    }
  }

  if (versions.length === 0) {
    throw new Error(`no AuditEvents found for policy rule ${ruleId}`);
  }

  return {
    ruleId,
    currentStatus: versions[versions.length - 1]!.status,
    versions,
    timeline,
    chainValid: true,
  };
}

function readPolicyRule(state: Record<string, unknown> | undefined): ActionPolicyRule | null {
  if (state === undefined) return null;
  const value = state["policyRule"];
  const parsed = actionPolicyRuleContract.safeParse(value);
  return parsed.success ? parsed.data : null;
}
