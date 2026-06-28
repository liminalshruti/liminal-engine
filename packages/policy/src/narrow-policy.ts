import {
  actionPolicyRuleContract,
  type ActionPolicyRule,
  type ActionPolicyStructuredCondition,
} from "@liminal-engine/contracts";

export interface Clock {
  now(): string;
}

export interface IdGen {
  next(): string;
}

export interface NarrowPolicyInput {
  rule: ActionPolicyRule;
  exception: ActionPolicyStructuredCondition;
}

export function narrowPolicy(
  input: NarrowPolicyInput,
  deps: { clock: Clock; idGen: IdGen },
): { narrowed: ActionPolicyRule; retired: ActionPolicyRule } {
  const rule = actionPolicyRuleContract.parse(input.rule);
  const retired: ActionPolicyRule = {
    ...rule,
    status: "retired",
  };
  const narrowed: ActionPolicyRule = {
    ...rule,
    id: deps.idGen.next(),
    version: rule.version + 1,
    scope: {
      ...rule.scope,
      condition: combineConditions(rule.scope.condition, input.exception),
    },
    status: "narrowed",
    supersedesId: rule.id,
    createdAt: deps.clock.now(),
  };
  return {
    retired: actionPolicyRuleContract.parse(retired),
    narrowed: actionPolicyRuleContract.parse(narrowed),
  };
}

function combineConditions(
  original: ActionPolicyStructuredCondition | undefined,
  exception: ActionPolicyStructuredCondition,
): ActionPolicyStructuredCondition {
  if (original === undefined) return exception;
  if (
    original.field === "reviews.approved"
    && original.op === "<"
    && typeof original.value === "number"
    && exception.field === "reviews.approved"
    && exception.op === ">="
    && typeof exception.value === "number"
  ) {
    return {
      field: "reviews.approved",
      op: "<",
      value: Math.min(original.value, exception.value),
    };
  }
  return original;
}
