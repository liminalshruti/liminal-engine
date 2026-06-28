import type { InterceptedAction, ActionPolicyRule } from "@liminal-engine/contracts";

export interface PolicyStore {
  activeRules(): Promise<ActionPolicyRule[]>;
  putRule(rule: ActionPolicyRule): Promise<void>;
  updateRule(rule: ActionPolicyRule): Promise<void>;
  byId(id: string): Promise<ActionPolicyRule | null>;
  allRules(): Promise<ActionPolicyRule[]>;
}

export interface QueuedIntercept {
  id: string;
  action: InterceptedAction;
  enqueuedAt: string;
}

export interface InterceptQueue {
  enqueue(item: QueuedIntercept): Promise<void>;
  pending(): Promise<QueuedIntercept[]>;
  remove(id: string): Promise<QueuedIntercept | null>;
}
