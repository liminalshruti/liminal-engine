/**
 * AuditSink adapter — in-memory FIXTURE STUB. Append-only audit evidence, no I/O
 * (ports onto anchor-receipt later behind the same interface). Implements
 * @liminal-engine/governance's AuditSink.
 */
import type { AuditEvent } from "@liminal-engine/contracts";
import type { AuditSink } from "@liminal-engine/governance";

export class InMemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async all(): Promise<AuditEvent[]> {
    return [...this.events];
  }
}
