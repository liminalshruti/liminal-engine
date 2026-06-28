/**
 * compile-correction - deterministic correction compiler for the "correct" phase.
 *
 * No LLM participates in this path. Operator free text is preserved on the
 * CorrectionEvent, but execution compiles only through the closed phrase table
 * below and onto the fixed EnforcementAction.actionType enum plus ActionPolicyRule data.
 */
import {
  evalCaseContract,
  enforcementActionContract,
  interceptedActionContract,
  actionPolicyRuleContract,
  type CorrectionEvent,
  type EnforcementAction,
  type EnforcementActionType,
  type EvalCase,
  type InterceptedAction,
  type ActionPolicyRule,
  type ActionPolicyRuleScope,
  type ActionPolicyVerdict,
  type ActionPolicyStructuredCondition,
} from "@liminal-engine/contracts";
import type { Clock, IdGen } from "./detect-miss.ts";

export interface CompileCorrectionDeps {
  clock: Clock;
  idGen: IdGen;
  originatingAction?: InterceptedAction;
}

export interface PolicyRulePreview {
  ruleId: string;
  summary: string;
  scope: ActionPolicyRuleScope;
  verdict: ActionPolicyVerdict;
  reasons: string[];
  requiredBefore: string[];
}

export interface CompiledCorrection {
  policyRules: ActionPolicyRule[];
  enforcementActions: EnforcementAction[];
  evalCases: EvalCase[];
  preview: PolicyRulePreview[];
}

interface Template {
  verdict: ActionPolicyVerdict;
  effectActionType: EnforcementActionType;
  summary: string;
  reason: string;
  requiredBefore: string;
  scopeOverride?: Partial<ActionPolicyRuleScope>;
  condition?: ActionPolicyStructuredCondition;
}

const VAGUE_CORRECTION_PATTERNS = [
  /^fix( it)?$/,
  /^do better$/,
  /^be careful$/,
  /^handle this$/,
  /^make it right$/,
  /^use judgment$/,
] as const;

export function compileCorrection(
  correction: CorrectionEvent,
  deps: CompileCorrectionDeps,
): CompiledCorrection {
  const atoms = atomicCorrections(correction.correction);
  if (atoms.length === 0) {
    throw new Error("correction is empty; provide a concrete rule such as 'never merge without both reviewers approving'");
  }

  const originatingAction = deps.originatingAction === undefined
    ? undefined
    : interceptedActionContract.parse(deps.originatingAction);

  const policyRules: ActionPolicyRule[] = [];
  const enforcementActions: EnforcementAction[] = [];
  const evalCases: EvalCase[] = [];
  const preview: PolicyRulePreview[] = [];

  for (const atom of atoms) {
    const template = templateFor(atom, originatingAction);
    const ruleId = deps.idGen.next();
    const evalCaseId = deps.idGen.next();
    const actionId = deps.idGen.next();

    const scope = scopeFor(template, originatingAction);
    const createdAt = deps.clock.now();
    const rule = actionPolicyRuleContract.parse({
      id: ruleId,
      version: 1,
      fromCorrectionId: correction.id,
      evalCaseId,
      scope,
      effect: {
        verdict: template.verdict,
        actionType: template.effectActionType,
        reasons: [template.reason],
        requiredBefore: [template.requiredBefore],
      },
      status: "proposed",
      createdAt,
    }) as ActionPolicyRule;

    const evalCase = evalCaseContract.parse({
      id: evalCaseId,
      dealId: correction.dealId,
      governanceCaseId: correction.caseId,
      criterion: `Policy ${rule.id} enforces: ${template.summary}`,
      createdAt: deps.clock.now(),
    }) as EvalCase;

    const action = enforcementActionContract.parse({
      id: actionId,
      caseId: correction.caseId,
      dealId: correction.dealId,
      fromStatus: "on-track",
      toStatus: "at-risk",
      actor: correction.decidingActor,
      enforcedAt: deps.clock.now(),
      actionType: "activate_policy",
      targetSystem: "policy",
      payload: {
        ruleId: rule.id,
        ruleStatus: rule.status,
        effectActionType: rule.effect.actionType,
        evalCaseId: evalCase.id,
      },
    }) as EnforcementAction;

    policyRules.push(rule);
    evalCases.push(evalCase);
    enforcementActions.push(action);
    preview.push({
      ruleId: rule.id,
      summary: template.summary,
      scope: rule.scope,
      verdict: rule.effect.verdict,
      reasons: [...rule.effect.reasons],
      requiredBefore: [...rule.effect.requiredBefore],
    });
  }

  return { policyRules, enforcementActions, evalCases, preview };
}

function atomicCorrections(correction: string): string[] {
  const trimmed = correction.trim();
  if (trimmed.length === 0) return [];
  const parts = trimmed
    .split(/(?:;|\n|\.\s+|\s+then\s+|\s+and\s+ask before\s+)/i)
    .map((part, index) => {
      if (index > 0 && /\s+and\s+ask before\s+/i.test(trimmed)) {
        return `ask before ${part.trim()}`;
      }
      return part.trim();
    })
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [trimmed];
}

function templateFor(atom: string, originatingAction: InterceptedAction | undefined): Template {
  const normalized = normalize(atom);
  if (isVague(normalized)) {
    throw new Error(
      `vague correction '${atom}' rejected; use a concrete template such as 'never do X' or 'ask before Y'`,
    );
  }

  if (
    normalized.includes("merge")
    && (normalized.includes("both reviewers approving")
      || normalized.includes("two reviewers approving")
      || normalized.includes("2 reviewers approving"))
  ) {
    return {
      verdict: "deny",
      effectActionType: "block_agent_action",
      summary: "deny PR merges until two reviewer approvals exist",
      reason: sentence(atom),
      requiredBefore: "Collect at least two approving reviews before merging.",
      scopeOverride: { tool: "gh", action: "pr-merge", targetPattern: "PR#*" },
      condition: { field: "reviews.approved", op: "<", value: 2 },
    };
  }

  // LIM-1375: a rejection-shaped merge correction ("never merge with an open
  // rejection" / "never merge while a review is rejected") must compile to the
  // structured reviews.rejected condition the policy engine already matches on.
  // Without this it falls through to the generic "never " branch below, which
  // scopes to the WHOLE gh pr-merge action with NO condition — so a later clean,
  // approved PR (reviews.rejected = 0) is denied too, reading as broken not smart.
  if (normalized.includes("merge") && mentionsRejection(normalized)) {
    return {
      verdict: "deny",
      effectActionType: "block_agent_action",
      summary: "deny PR merges while any review is rejected",
      reason: sentence(atom),
      requiredBefore: "Resolve every rejecting review before merging.",
      scopeOverride: { tool: "gh", action: "pr-merge", targetPattern: "PR#*" },
      condition: { field: "reviews.rejected", op: ">=", value: 1 },
    };
  }

  if (normalized.startsWith("never ")) {
    return {
      verdict: "deny",
      effectActionType: "block_agent_action",
      summary: `deny actions matching '${atom}'`,
      reason: sentence(atom),
      requiredBefore: "Route this action class through an explicit operator correction before retrying.",
      scopeOverride: inferScopeFromText(normalized, originatingAction),
    };
  }

  if (normalized.startsWith("ask before ")) {
    const subject = atom.replace(/^ask before\s+/i, "").trim();
    return {
      verdict: "ask",
      effectActionType: "require_approval",
      summary: `require operator approval before ${subject}`,
      reason: sentence(atom),
      requiredBefore: `Receive operator approval before ${subject}.`,
      scopeOverride: inferScopeFromText(normalized, originatingAction),
    };
  }

  if (normalized.startsWith("always include ")) {
    const required = atom.replace(/^always include\s+/i, "").trim();
    return {
      verdict: "deny",
      effectActionType: "block_agent_action",
      summary: `require output to include ${required}`,
      reason: sentence(atom),
      requiredBefore: `Include ${required} before completing the action.`,
      scopeOverride: inferScopeFromText(normalized, originatingAction),
    };
  }

  if (normalized.startsWith("match this shape")) {
    return {
      verdict: "ask",
      effectActionType: "generate_eval",
      summary: "require schema-shape review before completion",
      reason: sentence(atom),
      requiredBefore: "Attach a passing eval for the requested output shape.",
      scopeOverride: inferScopeFromText(normalized, originatingAction),
    };
  }

  if (normalized.includes("hard requirement") || normalized.includes("honor it before")) {
    return {
      verdict: "ask",
      effectActionType: "require_approval",
      summary: `require approval before bypassing correction '${atom}'`,
      reason: sentence(atom),
      requiredBefore: "Show the hard requirement is honored before proceeding.",
      scopeOverride: inferScopeFromText(normalized, originatingAction),
    };
  }

  throw new Error(
    `unsupported correction '${atom}'; supported templates are 'always include X', 'never do X', 'ask before Y', and 'match this shape'`,
  );
}

function scopeFor(template: Template, originatingAction: InterceptedAction | undefined): ActionPolicyRuleScope {
  const base: ActionPolicyRuleScope = {
    tool: originatingAction?.tool ?? "*",
    action: originatingAction?.action ?? "*",
    ...(originatingAction?.target !== undefined
      ? { targetPattern: targetPatternFor(originatingAction.target) }
      : {}),
  };
  return {
    ...base,
    ...template.scopeOverride,
    ...(template.condition !== undefined ? { condition: template.condition } : {}),
  };
}

function inferScopeFromText(
  normalized: string,
  originatingAction: InterceptedAction | undefined,
): Partial<ActionPolicyRuleScope> {
  if (normalized.includes("push --force") || normalized.includes("force push")) {
    return {
      tool: "git",
      action: "push",
      condition: { field: "args.force", op: "==", value: true },
    };
  }
  if (normalized.includes("fork")) {
    return { tool: "gh", action: "repo-fork" };
  }
  if (normalized.includes("visibility")) {
    return { tool: "gh", action: "repo-edit-visibility" };
  }
  if (normalized.includes("deploy")) {
    return { tool: "deploy", action: "deploy" };
  }
  if (normalized.includes("merge")) {
    return { tool: "gh", action: "pr-merge", targetPattern: "PR#*" };
  }
  if (originatingAction !== undefined) {
    return {
      tool: originatingAction.tool,
      action: originatingAction.action,
      ...(originatingAction.target !== undefined
        ? { targetPattern: targetPatternFor(originatingAction.target) }
        : {}),
    };
  }
  return {};
}

function targetPatternFor(target: string): string {
  if (/^PR#\d+$/.test(target)) return "PR#*";
  return target;
}

function isVague(normalized: string): boolean {
  return normalized.split(/\s+/).length < 3
    || VAGUE_CORRECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

// LIM-1375: detect that a correction is about a rejecting review, so a merge
// correction can be compiled to the reviews.rejected condition rather than a
// blanket block. Covers reject/rejects/rejected/rejecting/rejection(s) and the
// GitHub "changes requested" phrasing for the same concept.
function mentionsRejection(normalized: string): boolean {
  return /\breject(?:s|ed|ing|ion|ions)?\b/.test(normalized)
    || normalized.includes("changes requested")
    || normalized.includes("requested changes");
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.?!]+$/g, "")
    .replace(/\s+/g, " ");
}

function sentence(value: string): string {
  const trimmed = value.trim().replace(/[.?!]+$/g, "");
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.`;
}
