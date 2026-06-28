/**
 * ActionGateStore adapter — in-memory FIXTURE STUB. Tracks which downstream
 * actions are blocked by an open governance case. Implements
 * @liminal-engine/governance's ActionGateStore.
 */
import { type ActionGate, isAllowed } from "@liminal-engine/contracts";
import type { ActionGateStore } from "@liminal-engine/governance";

export class InMemoryActionGateStore implements ActionGateStore {
  private readonly gates = new Map<string, ActionGate>();

  async gate(gate: ActionGate): Promise<void> {
    this.gates.set(gate.id, gate);
  }

  async isBlocked(action: string): Promise<boolean> {
    for (const g of this.gates.values()) {
      // a gate with any reasons is not allowed ⇒ the action is blocked
      if (g.action === action && !isAllowed(g)) return true;
    }
    return false;
  }
}
