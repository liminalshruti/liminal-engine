import type { InterceptedAction, ActionPolicyRule, AuditEvent } from "@liminal-engine/contracts";

/**
 * Read side of the append-only audit ledger — the grounding source for operator
 * NL queries (LIM-1345). The domain depends on this port, not the concrete
 * governance `AuditLedger`; an adapter at the composition root wires it
 * (`SealedAuditEvent extends AuditEvent`, so `ledger.events()` satisfies it).
 */
export interface LedgerReader {
  events(): Promise<readonly AuditEvent[]>;
}

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
