/**
 * ActionGateStore adapter — in-memory FIXTURE STUB. Tracks which downstream
 * actions are blocked by an open governance case. Implements
 * @liminal-engine/governance's ActionGateStore.
 */
import type { ActionGate } from "@liminal-engine/contracts";
import type { ActionGateStore } from "@liminal-engine/governance";

export class InMemoryActionGateStore implements ActionGateStore {
  private readonly gates = new Map<string, ActionGate>();

  async gate(gate: ActionGate): Promise<void> {
    this.gates.set(gate.id, gate);
  }

  async isBlocked(action: string): Promise<boolean> {
    for (const g of this.gates.values()) {
      if (g.action === action && g.blocked) return true;
    }
    return false;
  }
}
