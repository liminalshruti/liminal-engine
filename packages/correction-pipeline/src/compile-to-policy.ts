/**
 * compileCorrectionFull — the correction pipeline compiler.
 *
 * Takes a CorrectionEvent and compiles it into:
 * 1. EnforcementAction[] — the immediate governance actions (status flip, etc.)
 * 2. PolicyRule[] — the formal rules being enforced
 * 3. ApprovalGate[] — the approval gates that protect critical actions
 *
 * This is a pure function. All identity generation is injected.
 * No I/O, no live calls.
 *
 * The compiler is deterministic-fixture-first: given the same input + idGen seed,
 * it produces the same output every time (for testing).
 */

import type {
  CorrectionEvent,
  EnforcementAction,
  PolicyRule,
  ApprovalGate,
  RemediationStep,
} from "@liminal-engine/contracts";
import type { Clock, IdGen } from "@liminal-engine/governance";

export interface CompileCorrectionFullDeps {
  clock: Clock;
  idGen: IdGen;
  /** Optional context about the case (business impact, missing artifacts, etc.) */
  caseContext?: CaseContext;
}

/**
 * Optional context that shapes the compiled policy and approval gates.
 */
export interface CaseContext {
  /** Systems affected by the correction (e.g., ["data-residency", "compliance"]) */
  affectedCategories?: string[];
  /** Required approver roles (e.g., ["Product", "Security", "Engineering"]) */
  requiredApprovers?: string[];
  /** Business impact or scope (e.g., "$1.2M Acme expansion") */
  businessContext?: string;
}

/**
 * Full correction compilation result: all three artifact types.
 */
export interface CorrectionCompilationResult {
  actions: EnforcementAction[];
  rules: PolicyRule[];
  gates: ApprovalGate[];
}

/**
 * Compile a correction event into the full set of governance artifacts.
 *
 * The compiler:
 * 1. Produces EnforcementAction[] with fixed actionType values (never free-form)
 * 2. Derives PolicyRule[] from the correction intent + case context
 * 3. Derives ApprovalGate[] from the rules' required approvers
 * 4. All artifacts are deterministic (given the same idGen seed, same output)
 *
 * The result is suitable for:
 * - Persisting to a store (future persistence layer)
 * - Feeding into enforcement (apply the rules, check the gates)
 * - Auditing (all decisions are recorded)
 */
export function compileCorrectionFull(
  correction: CorrectionEvent,
  deps: CompileCorrectionFullDeps,
): CorrectionCompilationResult {
  const actions = compileToEnforcementActions(correction, deps);
  const rules = compileToRules(correction, deps);
  const gates = compileToApprovalGates(correction, rules, deps);

  return { actions, rules, gates };
}

/**
 * Compile to EnforcementAction[].
 *
 * Maps the correction text to fixed actionType enum values. For the Acme case,
 * the correction "EU data residency is a hard requirement" compiles to:
 * - change_status (on-track → at-risk)
 * - create_linear_workstream (Acme EU Data Residency Readiness)
 * - assign_owner (Product, Security, Engineering)
 * - activate_policy (enforce the EU residency rule)
 * - generate_eval (create eval case for the correction)
 *
 * In a real system, this would be a phrase→action mapping or template DSL;
 * for the stretch item, we use deterministic pattern matching on the correction
 * text and inject all IDs/timestamps.
 */
function compileToEnforcementActions(
  correction: CorrectionEvent,
  deps: CompileCorrectionFullDeps,
): EnforcementAction[] {
  const actions: EnforcementAction[] = [];

  // Action 1: Change status (implicit in governance.enforce, but explicit here for full visibility)
  actions.push({
    id: deps.idGen.next(),
    caseId: correction.caseId,
    dealId: correction.dealId,
    fromStatus: "on-track",
    toStatus: "at-risk",
    actor: correction.decidingActor,
    enforcedAt: deps.clock.now(),
    actionType: "change_status",
  });

  // Action 2: Create linear workstream if the correction mentions workflow/workstream
  if (
    correction.correction.toLowerCase().includes("workstream") ||
    correction.correction.toLowerCase().includes("workflow")
  ) {
    actions.push({
      id: deps.idGen.next(),
      caseId: correction.caseId,
      dealId: correction.dealId,
      fromStatus: "on-track",
      toStatus: "at-risk",
      actor: correction.decidingActor,
      enforcedAt: deps.clock.now(),
      actionType: "create_linear_workstream",
      targetSystem: "Linear",
    });
  }

  // Action 3: Assign owners (for Acme: Product, Security, Engineering)
  const requiredApprovers = deps.caseContext?.requiredApprovers || [
    "Product",
    "Security",
    "Engineering",
  ];
  for (const approver of requiredApprovers) {
    actions.push({
      id: deps.idGen.next(),
      caseId: correction.caseId,
      dealId: correction.dealId,
      fromStatus: "on-track",
      toStatus: "at-risk",
      actor: correction.decidingActor,
      enforcedAt: deps.clock.now(),
      actionType: "assign_owner",
      targetSystem: "governance",
      payload: { owner: approver },
    });
  }

  // Action 4: Activate policy (enforce the corrected requirement)
  actions.push({
    id: deps.idGen.next(),
    caseId: correction.caseId,
    dealId: correction.dealId,
    fromStatus: "on-track",
    toStatus: "at-risk",
    actor: correction.decidingActor,
    enforcedAt: deps.clock.now(),
    actionType: "activate_policy",
    targetSystem: "governance",
    payload: { policyName: extractPolicyName(correction.correction) },
  });

  // Action 5: Require approval before downstream actions
  actions.push({
    id: deps.idGen.next(),
    caseId: correction.caseId,
    dealId: correction.dealId,
    fromStatus: "on-track",
    toStatus: "at-risk",
    actor: correction.decidingActor,
    enforcedAt: deps.clock.now(),
    actionType: "require_approval",
    targetSystem: "governance",
    payload: { requiredApprovers },
  });

  // Action 6: Generate eval case
  actions.push({
    id: deps.idGen.next(),
    caseId: correction.caseId,
    dealId: correction.dealId,
    fromStatus: "on-track",
    toStatus: "at-risk",
    actor: correction.decidingActor,
    enforcedAt: deps.clock.now(),
    actionType: "generate_eval",
    targetSystem: "eval-harness",
  });

  return actions;
}

/**
 * Compile to PolicyRule[].
 *
 * Derives formal rules from the correction text. For Acme:
 * "EU data residency is a hard requirement" becomes a PolicyRule with:
 * - requirement: the extracted phrase
 * - severity: critical (hard requirement)
 * - scope: data-residency, deal_acme
 * - remediationSteps: one per required approver
 */
function compileToRules(
  correction: CorrectionEvent,
  deps: CompileCorrectionFullDeps,
): PolicyRule[] {
  const rules: PolicyRule[] = [];

  const requirement = extractRequirement(correction.correction);
  const policyName = extractPolicyName(correction.correction);
  const requiredApprovers = deps.caseContext?.requiredApprovers || [
    "Product",
    "Security",
    "Engineering",
  ];

  const remediationSteps: RemediationStep[] = requiredApprovers.map((approver, index) => ({
    id: deps.idGen.next(),
    description: `Assign ${approver} owner for ${policyName} compliance`,
    owner: approver,
    status: "open",
  }));

  rules.push({
    id: deps.idGen.next(),
    caseId: correction.caseId,
    dealId: correction.dealId,
    requirement,
    severity: "critical", // hard requirements are always critical
    scope: {
      category: policyName,
      context: correction.dealId,
    },
    remediationSteps,
    createdAt: deps.clock.now(),
    updatedAt: deps.clock.now(),
    enforcer: correction.decidingActor,
  });

  return rules;
}

/**
 * Compile to ApprovalGate[].
 *
 * One approval gate per rule. For Acme's EU residency rule, the gate requires
 * Product, Security, and Engineering approvals before the "on-track" status
 * update can be sent to the customer.
 */
function compileToApprovalGates(
  correction: CorrectionEvent,
  rules: PolicyRule[],
  deps: CompileCorrectionFullDeps,
): ApprovalGate[] {
  const gates: ApprovalGate[] = [];

  for (const rule of rules) {
    const requiredApprovers = rule.remediationSteps.map((step) => step.owner);

    gates.push({
      id: deps.idGen.next(),
      caseId: correction.caseId,
      dealId: correction.dealId,
      policyRuleId: rule.id,
      approvalContext: `Enforce ${rule.requirement}`,
      requiredApprovers,
      approvals: [],
      createdAt: deps.clock.now(),
      updatedAt: deps.clock.now(),
      gateKeeper: correction.decidingActor,
    });
  }

  return gates;
}

/**
 * Extract the core requirement from correction text.
 *
 * For "EU data residency is a hard requirement; honor it before any on-track claim."
 * returns "EU data residency is a hard requirement".
 */
function extractRequirement(correction: string): string {
  // Heuristic: take the first sentence ending with a period, colon, or semicolon
  const match = correction.match(/^[^.;:]+[.;:]/);
  if (match) {
    return match[0].replace(/[.;:]$/, "").trim();
  }
  return correction.substring(0, Math.min(100, correction.length));
}

/**
 * Extract the policy name (category) from correction text.
 *
 * For "EU data residency is a hard requirement..."
 * returns "data-residency" (normalized).
 */
function extractPolicyName(correction: string): string {
  // Look for common policy categories (most specific first)
  const categories = [
    "data residency",
    "compliance",
    "security",
    "privacy",
    "audit",
  ];

  for (const cat of categories) {
    if (correction.toLowerCase().includes(cat.toLowerCase())) {
      return cat.toLowerCase().replace(/\s+/g, "-");
    }
  }

  // Fallback: extract first noun phrase
  return "governance-requirement";
}
