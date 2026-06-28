import {
  correctionEventContract,
  evalCaseContract,
  interceptedActionContract,
  actionPolicyRuleContract,
  type CorrectionEvent,
  type EvalCase,
  type InterceptedAction,
  type ActionPolicyRule,
  type ActionPolicyRuleScope,
} from "@liminal-engine/contracts";
import {
  appendPolicyRuleAudit,
  appendPolicyVerdictAudit,
  AuditLedger,
  compileCorrection,
  type Clock,
  type IdGen,
  type PolicyRulePreview,
} from "@liminal-engine/governance";
import {
  decideFromStore,
  type InterceptQueue,
  type PolicyDecision,
  type PolicyMode,
  type ProxyScope,
  type PolicyStore,
  type QueuedIntercept,
} from "@liminal-engine/policy";
import type { ProxyHistory, ProxyHistoryEntry, ProxyHistoryFilter, ProxyOutcome } from "./history.ts";
import {
  applyMatchReplaceRules,
  type MatchReplaceRule,
} from "./match-replace.ts";

export interface InterceptGatewayDeps {
  policyStore: PolicyStore;
  interceptQueue: InterceptQueue;
  history: ProxyHistory;
  ledger: AuditLedger;
  clock: Clock;
  idGen: IdGen;
  mode: PolicyMode;
  scope?: ProxyScope;
  matchReplaceRules?: readonly MatchReplaceRule[];
  caseId: string;
  dealId: string;
  decidingActor: string;
}

export interface OperatorVerdictInput {
  queueId: string;
  verdict: "approve" | "disapprove";
  reason: string;
  activate?: boolean;
  editedAction?: InterceptedAction;
}

export interface OperatorVerdictResult {
  decision: PolicyDecision;
  compiledRules: ActionPolicyRule[];
  evalCases: EvalCase[];
  preview: PolicyRulePreview[];
}

export interface RepeaterInput {
  action?: InterceptedAction;
  historyId?: string;
  mode?: PolicyMode;
  applyMatchReplace?: boolean;
}

export interface RepeaterResult {
  action: InterceptedAction;
  decision: PolicyDecision;
}

export type ProxyOutcomeInput = ProxyOutcome;

export class InterceptGateway {
  readonly #deps: InterceptGatewayDeps;
  #matchReplaceRules: MatchReplaceRule[];

  constructor(deps: InterceptGatewayDeps) {
    this.#deps = deps;
    this.#matchReplaceRules = deps.matchReplaceRules === undefined ? [] : [...deps.matchReplaceRules];
  }

  setMode(mode: PolicyMode): void {
    this.#deps.mode = mode;
  }

  setScope(scope: ProxyScope | undefined): void {
    this.#deps.scope = scope;
  }

  scope(): ProxyScope | undefined {
    return this.#deps.scope;
  }

  setMatchReplaceRules(rules: readonly MatchReplaceRule[]): void {
    this.#matchReplaceRules = rules.map((rule) => ({ ...rule }));
  }

  matchReplaceRules(): MatchReplaceRule[] {
    return this.#matchReplaceRules.map((rule) => ({ ...rule }));
  }

  async health(): Promise<{ mode: PolicyMode; ruleCount: number; queueDepth: number; historyCount: number }> {
    return {
      mode: this.#deps.mode,
      ruleCount: (await this.#deps.policyStore.activeRules()).length,
      queueDepth: (await this.#deps.interceptQueue.pending()).length,
      historyCount: (await this.#deps.history.all()).length,
    };
  }

  async intercept(rawAction: InterceptedAction): Promise<PolicyDecision> {
    const raw = interceptedActionContract.parse(rawAction);
    const prepared = this.prepareAction(raw, true);
    const action = prepared.action;
    const decision = await this.decide(action, this.#deps.mode);
    let queueId: string | undefined;

    if (decision.verdict === "ask") {
      try {
        queueId = this.#deps.idGen.next();
        await this.#deps.interceptQueue.enqueue({
          id: queueId,
          action,
          enqueuedAt: this.#deps.clock.now(),
        });
      } catch (error) {
        const detail = error instanceof Error && error.message.length > 0 ? `: ${error.message}` : "";
        const failedClosed: PolicyDecision = {
          verdict: "deny",
          allowed: false,
          reasons: [`Intercept queue failed closed${detail}.`],
          requiredBeforeSend: ["Restore the intercept queue before running consequential actions."],
          source: "default-deny",
        };
        this.appendVerdict(action, failedClosed);
        await this.recordHistory(action, failedClosed, {
          originalAction: prepared.originalAction,
          appliedMatchReplaceRuleIds: prepared.appliedMatchReplaceRuleIds,
        });
        return failedClosed;
      }
    }

    this.appendVerdict(action, decision);
    await this.recordHistory(action, decision, {
      queueId,
      originalAction: prepared.originalAction,
      appliedMatchReplaceRuleIds: prepared.appliedMatchReplaceRuleIds,
    });
    return decision;
  }

  async pending(): Promise<QueuedIntercept[]> {
    return this.#deps.interceptQueue.pending();
  }

  async history(filter?: ProxyHistoryFilter): Promise<ProxyHistoryEntry[]> {
    return this.#deps.history.all(filter);
  }

  async recordOutcome(input: ProxyOutcomeInput): Promise<ProxyOutcome> {
    await this.#deps.history.recordOutcome(input);
    this.#deps.ledger.append({
      id: this.#deps.idGen.next(),
      caseId: this.#deps.caseId,
      dealId: this.#deps.dealId,
      action: "policy.outcome",
      decidingActor: this.#deps.decidingActor,
      previousStatus: "at-risk",
      newStatus: "at-risk",
      recordedAt: this.#deps.clock.now(),
      afterState: {
        actionOutcome: input,
      },
      evidenceIds: [input.actionId],
    });
    return input;
  }

  async repeater(input: RepeaterInput): Promise<RepeaterResult> {
    const raw = await this.repeaterAction(input);
    const prepared = this.prepareAction(raw, input.applyMatchReplace !== false);
    const action = prepared.action;
    const result = {
      action,
      decision: await this.decide(action, input.mode ?? this.#deps.mode),
    };
    this.appendVerdict(action, result.decision);
    await this.recordHistory(action, result.decision, {
      originalAction: prepared.originalAction,
      appliedMatchReplaceRuleIds: prepared.appliedMatchReplaceRuleIds,
      notes: ["repeater.send"],
    });
    return result;
  }

  async forward(input: Omit<OperatorVerdictInput, "verdict">): Promise<OperatorVerdictResult> {
    return this.operatorVerdict({ ...input, verdict: "approve" });
  }

  async drop(input: Omit<OperatorVerdictInput, "verdict">): Promise<OperatorVerdictResult> {
    return this.operatorVerdict({ ...input, verdict: "disapprove" });
  }

  async forwardAll(input: { reason?: string } = {}): Promise<OperatorVerdictResult[]> {
    const pending = await this.pending();
    const results: OperatorVerdictResult[] = [];
    for (const item of pending) {
      results.push(await this.forward({
        queueId: item.id,
        reason: input.reason ?? `forward ${item.action.tool} ${item.action.action}`,
      }));
    }
    return results;
  }

  async dropAll(input: { reason: string; activate?: boolean }): Promise<OperatorVerdictResult[]> {
    const pending = await this.pending();
    const results: OperatorVerdictResult[] = [];
    for (const item of pending) {
      results.push(await this.drop({
        queueId: item.id,
        reason: input.reason,
        activate: input.activate,
      }));
    }
    return results;
  }

  async operatorVerdict(input: OperatorVerdictInput): Promise<OperatorVerdictResult> {
    const item = await this.#deps.interceptQueue.remove(input.queueId);
    if (item === null) {
      throw new Error(`no queued intercept ${input.queueId}`);
    }
    const action = input.editedAction === undefined
      ? item.action
      : interceptedActionContract.parse(input.editedAction);
    const originalAction = input.editedAction === undefined ? undefined : item.action;

    if (input.verdict === "approve") {
      const correction = correctionEventContract.parse({
        id: this.#deps.idGen.next(),
        caseId: this.#deps.caseId,
        dealId: this.#deps.dealId,
        correction: input.reason.trim().length > 0
          ? input.reason
          : `approve ${action.tool} ${action.action}`,
        decidingActor: this.#deps.decidingActor,
        correctedAt: this.#deps.clock.now(),
      }) as CorrectionEvent;
      const decision: PolicyDecision = {
        verdict: "allow",
        allowed: true,
        reasons: [],
        requiredBeforeSend: [],
        source: "operator",
      };
      this.appendVerdict(action, decision, correction.id);
      await this.recordHistory(action, decision, {
        queueId: input.queueId,
        originalAction,
        notes: ["intercept.forward"],
      });

      const { rule, evalCase } = this.compileApprovalRule(action, correction.id, correction.correction);
      await this.#deps.policyStore.putRule(rule);
      appendPolicyRuleAudit(
        this.#deps.ledger,
        {
          caseId: this.#deps.caseId,
          dealId: this.#deps.dealId,
          decidingActor: this.#deps.decidingActor,
          rule,
        },
        this.#deps,
      );
      return { decision, compiledRules: [rule], evalCases: [evalCase], preview: [] };
    }

    const correction = correctionEventContract.parse({
      id: this.#deps.idGen.next(),
      caseId: this.#deps.caseId,
      dealId: this.#deps.dealId,
      correction: input.reason,
      decidingActor: this.#deps.decidingActor,
      correctedAt: this.#deps.clock.now(),
    }) as CorrectionEvent;

    const denied: PolicyDecision = {
      verdict: "deny",
      allowed: false,
      reasons: [input.reason],
      requiredBeforeSend: ["Activate the compiled policy rule or correct the action before retrying."],
      source: "operator",
    };
    this.appendVerdict(action, denied, correction.id);
    await this.recordHistory(action, denied, {
      queueId: input.queueId,
      originalAction,
      notes: ["intercept.drop"],
    });

    const compiled = compileCorrection(correction, {
      clock: this.#deps.clock,
      idGen: this.#deps.idGen,
      originatingAction: action,
    });

    const storedRules: ActionPolicyRule[] = [];
    for (const proposed of compiled.policyRules) {
      await this.#deps.policyStore.putRule(proposed);
      appendPolicyRuleAudit(
        this.#deps.ledger,
        {
          caseId: this.#deps.caseId,
          dealId: this.#deps.dealId,
          decidingActor: this.#deps.decidingActor,
          rule: proposed,
        },
        this.#deps,
      );

      if (input.activate === true) {
        const active: ActionPolicyRule = { ...proposed, status: "active" };
        await this.#deps.policyStore.updateRule(active);
        appendPolicyRuleAudit(
          this.#deps.ledger,
          {
            caseId: this.#deps.caseId,
            dealId: this.#deps.dealId,
            decidingActor: this.#deps.decidingActor,
            rule: active,
          },
          this.#deps,
        );
        storedRules.push(active);
      } else {
        storedRules.push(proposed);
      }
    }

    return {
      decision: denied,
      compiledRules: storedRules,
      evalCases: compiled.evalCases,
      preview: compiled.preview,
    };
  }

  private appendVerdict(action: InterceptedAction, decision: PolicyDecision, fromCorrectionId?: string): void {
    appendPolicyVerdictAudit(
      this.#deps.ledger,
      {
        caseId: this.#deps.caseId,
        dealId: this.#deps.dealId,
        decidingActor: this.#deps.decidingActor,
        action,
        decision,
        ...(fromCorrectionId !== undefined ? { fromCorrectionId } : {}),
      },
      this.#deps,
    );
  }

  private async decide(action: InterceptedAction, mode: PolicyMode): Promise<PolicyDecision> {
    return decideFromStore(action, this.#deps.policyStore, {
      mode,
      ...(this.#deps.scope !== undefined ? { scope: this.#deps.scope } : {}),
    });
  }

  private async recordHistory(
    action: InterceptedAction,
    decision: PolicyDecision,
    options: {
      queueId?: string;
      originalAction?: InterceptedAction;
      appliedMatchReplaceRuleIds?: string[];
      notes?: string[];
    } = {},
  ): Promise<void> {
    await this.#deps.history.record({
      id: this.#deps.idGen.next(),
      ...(options.originalAction !== undefined ? { originalAction: options.originalAction } : {}),
      action,
      decision,
      mode: this.#deps.mode,
      recordedAt: this.#deps.clock.now(),
      ...(options.queueId !== undefined ? { queueId: options.queueId } : {}),
      ...(options.appliedMatchReplaceRuleIds !== undefined && options.appliedMatchReplaceRuleIds.length > 0
        ? { appliedMatchReplaceRuleIds: options.appliedMatchReplaceRuleIds }
        : {}),
      ...(options.notes !== undefined ? { notes: options.notes } : {}),
    });
  }

  private prepareAction(
    rawAction: InterceptedAction,
    applyRules: boolean,
  ): {
    action: InterceptedAction;
    originalAction?: InterceptedAction;
    appliedMatchReplaceRuleIds?: string[];
  } {
    if (!applyRules || this.#matchReplaceRules.length === 0) {
      return { action: rawAction };
    }
    const result = applyMatchReplaceRules(rawAction, this.#matchReplaceRules);
    if (result.appliedRuleIds.length === 0) {
      return { action: result.action };
    }
    return {
      action: result.action,
      originalAction: rawAction,
      appliedMatchReplaceRuleIds: result.appliedRuleIds,
    };
  }

  private async repeaterAction(input: RepeaterInput): Promise<InterceptedAction> {
    if (input.action !== undefined) {
      return interceptedActionContract.parse(input.action);
    }
    if (input.historyId !== undefined) {
      const entry = await this.#deps.history.byId(input.historyId);
      if (entry === null) {
        throw new Error(`no proxy history entry ${input.historyId}`);
      }
      return entry.action;
    }
    throw new Error("repeater requires either action or historyId");
  }

  private compileApprovalRule(
    action: InterceptedAction,
    correctionId: string,
    reason: string,
  ): { rule: ActionPolicyRule; evalCase: EvalCase } {
    const ruleId = this.#deps.idGen.next();
    const evalCaseId = this.#deps.idGen.next();
    const createdAt = this.#deps.clock.now();
    const trimmedReason = reason.trim();

    const rule = actionPolicyRuleContract.parse({
      id: ruleId,
      version: 1,
      fromCorrectionId: correctionId,
      evalCaseId,
      scope: approvalScopeFor(action),
      effect: {
        verdict: "allow",
        actionType: "activate_policy",
        reasons: [],
        requiredBefore: [],
      },
      status: "active",
      createdAt,
    }) as ActionPolicyRule;

    const evalCase = evalCaseContract.parse({
      id: evalCaseId,
      dealId: this.#deps.dealId,
      governanceCaseId: this.#deps.caseId,
      criterion: trimmedReason.length > 0
        ? `Policy ${rule.id} preserves approved class: ${trimmedReason}`
        : `Policy ${rule.id} preserves approved class: ${action.tool} ${action.action}`,
      createdAt: this.#deps.clock.now(),
    }) as EvalCase;

    return { rule, evalCase };
  }
}

function approvalScopeFor(action: InterceptedAction): ActionPolicyRuleScope {
  const scope: ActionPolicyRuleScope = {
    tool: action.tool,
    action: action.action,
    ...(action.target !== undefined ? { targetPattern: targetPatternFor(action.target) } : {}),
  };
  const approvals = readPath(action.args, ["reviews", "approved"]);
  if (action.tool === "gh" && action.action === "pr-merge" && typeof approvals === "number") {
    return {
      ...scope,
      condition: { field: "reviews.approved", op: ">=", value: approvals },
    };
  }
  return scope;
}

function targetPatternFor(target: string): string {
  if (/^PR#\d+$/.test(target)) return "PR#*";
  return target;
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let cursor = value;
  for (const key of path) {
    if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}
