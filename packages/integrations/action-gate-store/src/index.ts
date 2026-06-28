/**
 * ActionGateStore adapter — in-memory FIXTURE STUB. Tracks which downstream
 * actions are blocked by an open governance case. Implements
 * @liminal-engine/governance's ActionGateStore.
 */
import {
  actionGateDecision,
  type ActionGate,
  type ActionGateDecision,
} from "@liminal-engine/contracts";
import type { ActionGateStore } from "@liminal-engine/governance";

export class InMemoryActionGateStore implements ActionGateStore {
  private readonly gates = new Map<string, ActionGate>();

  async gate(gate: ActionGate): Promise<void> {
    this.gates.set(gate.id, gate);
  }

  async decisionFor(action: string): Promise<ActionGateDecision> {
    for (const g of this.gates.values()) {
      const decision = actionGateDecision(g);
      if (g.action === action && !decision.allowed) return decision;
    }
    return {
      allowed: true,
      reasons: [],
      requiredBeforeSend: [],
    };
  }
}
