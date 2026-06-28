/**
 * audit-ledger — a hash-chained, append-only audit ledger (LIM-1229).
 *
 * Makes the governance audit trail tamper-EVIDENT, not just append-once: every
 * recorded AuditEvent carries `eventHash = sha256(prevHash + canonical_json(payload))`,
 * where `prevHash` is the prior event's `eventHash` (genesis for the first). The
 * `prevHash` link is folded INTO the hashed payload via the existing
 * `AuditEvent.prevHash` field, so a single canonical projection captures both the
 * payload and its chain position — there is no bespoke hashing here. We reuse the
 * contract's own canonical hash (`auditEventContract.canonical` + `canonicalHash`
 * from @liminal-engine/contracts), the same digest mechanism that ports into the
 * liminal-agents-v1 substrate as a tamper-evident receipt.
 *
 * What this module owns (per LIM-1229 acceptance):
 *   - ONE append-only writer (`AuditLedger.append`) — the only way an event is
 *     sealed with a hash; the chain link is computed, never caller-supplied.
 *   - a verifier (`verifyChain`) that (a) confirms a well-formed chain, and
 *     (b) fails — pinpointing the index — on any tampered payload or spliced link.
 *   - a reconstructor (`reconstructCaseLifecycle`) that (c) rebuilds a case's
 *     lifecycle from AuditEvents ALONE (no external store), refusing to interpret
 *     a chain that does not verify.
 *
 * Determinism: this module computes only hashes from caller-provided payloads. It
 * never reads the clock or RNG — `recordedAt`/`id` are injected upstream (the
 * use-cases layer), preserving the fixtures-determinism rule on the demo spine.
 *
 * Boundary: imports @liminal-engine/contracts only (shared kernel) — no concrete
 * adapter, no engine-core internals (enforced by .dependency-cruiser.cjs).
 */
import {
  auditEventContract,
  canonicalHash,
  type AuditEvent,
} from "@liminal-engine/contracts";

/**
 * A sealed ledger entry: the validated AuditEvent (with its `prevHash` chain
 * link) plus the computed `eventHash`. `eventHash` is derived, so it lives
 * outside the AuditEvent contract — the contract owns the payload, the ledger
 * owns the chain.
 */
export interface SealedAuditEvent extends AuditEvent {
  /** sha256 over the canonical payload (which already embeds prevHash). */
  readonly eventHash: string;
}

/**
 * The named event-type vocabulary (IDEAS.md line 51). Lifecycle beats the demo
 * and tests assert against. `AuditEvent.action` is a free-form string on the
 * contract; this is the curated vocabulary the governance loop emits, exposed so
 * callers/tests have a single source of truth to assert membership against.
 */
export const AUDIT_EVENT_TYPES = [
  "goal.created",
  "case.opened",
  "correction.proposed",
  "correction.enforced",
  "correction-enforced", // legacy spelling used by the locked Acme fixture
  "gate.evaluated",
  "owner.assigned",
  "eval.generated",
  "eval.passed",
  "eval.failed",
  "case.closed",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/** The deterministic hash of an event's canonical payload (prevHash included). */
function hashEvent(event: AuditEvent): string {
  // Reuse the contract's canonical projection verbatim — prev_hash is projected
  // into it whenever present, so this single call realizes
  // sha256(prevHash + canonical_json(payload)) without hand-built string glue.
  return canonicalHash(auditEventContract.canonical(event));
}

/**
 * The append-only writer. Holds the chain in memory; every `append` seals the
 * next event onto the tail's hash. There is no public mutation path other than
 * appending — sealed events are frozen, and `events()` returns a copy.
 */
export class AuditLedger {
  /**
   * The genesis link — the prevHash of the first event. A fixed, non-empty
   * sentinel (the contract requires prevHash be a non-empty string when present)
   * so the head of the chain is itself anchored and a head event cannot be
   * silently dropped without the next event's prevHash failing to match.
   */
  static readonly GENESIS = "genesis";

  #chain: SealedAuditEvent[] = [];

  /**
   * Seal a new event onto the chain. The caller supplies the payload WITHOUT a
   * prevHash; the ledger assigns prevHash (tail's eventHash, or GENESIS) and
   * computes eventHash. Validates through the contract so a malformed payload is
   * rejected at the writer boundary. Returns the frozen sealed event.
   */
  append(input: Omit<AuditEvent, "prevHash">): SealedAuditEvent {
    const tail = this.#chain[this.#chain.length - 1];
    const prevHash = tail ? tail.eventHash : AuditLedger.GENESIS;

    // parse through the contract: validates the payload AND normalizes it to the
    // exact AuditEvent shape that will be hashed (untrusted input never bypasses
    // validation at the append boundary).
    const event = auditEventContract.parse({ ...input, prevHash }) as AuditEvent;
    const eventHash = hashEvent(event);

    const sealed = Object.freeze({ ...event, eventHash }) as SealedAuditEvent;
    this.#chain.push(sealed);
    return sealed;
  }

  /** A defensive copy of the sealed chain in append order. */
  events(): SealedAuditEvent[] {
    return [...this.#chain];
  }

  /** Convenience: load an existing chain (e.g. from a store) into a ledger to continue it. */
  static fromEvents(events: readonly SealedAuditEvent[]): AuditLedger {
    const ledger = new AuditLedger();
    ledger.#chain = events.map((e) => Object.freeze({ ...e }) as SealedAuditEvent);
    return ledger;
  }
}

/** Verdict of a chain verification. `brokenAt` is the index of the first bad link. */
export interface ChainVerification {
  valid: boolean;
  /** number of events examined. */
  length: number;
  /** index of the first event whose link/hash failed; absent when valid. */
  brokenAt?: number;
  /** human-readable reason for the failure; absent when valid. */
  reason?: string;
}

/**
 * Verify a hash chain. Walks the events in order, recomputing each event's hash
 * from the SAME canonical projection used to write it and checking two things at
 * every node:
 *   1. the event's stored `prevHash` equals the expected running link
 *      (GENESIS for the head, else the previous event's recomputed hash), and
 *   2. the event's stored `eventHash` equals its recomputed hash.
 *
 * Because each node's expected prevHash is the PREVIOUS node's recomputed hash,
 * mutating any earlier payload changes that node's hash and breaks the NEXT
 * node's link — that propagation is what makes the chain tamper-EVIDENT.
 */
export function verifyChain(events: readonly SealedAuditEvent[]): ChainVerification {
  let expectedPrev = AuditLedger.GENESIS;

  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;

    if (e.prevHash !== expectedPrev) {
      return {
        valid: false,
        length: events.length,
        brokenAt: i,
        reason:
          i === 0
            ? `chain head prevHash ${String(e.prevHash)} != genesis (event may be spliced/dropped)`
            : `prevHash at index ${i} does not link to the prior event's hash (broken chain)`,
      };
    }

    const recomputed = hashEvent(e);
    if (recomputed !== e.eventHash) {
      return {
        valid: false,
        length: events.length,
        brokenAt: i,
        reason: `eventHash mismatch at index ${i}: payload was tampered after sealing`,
      };
    }

    expectedPrev = recomputed;
  }

  return { valid: true, length: events.length };
}

/** A case lifecycle rebuilt purely from its AuditEvents. */
export interface ReconstructedCase {
  caseId: string;
  dealId: string;
  /** the latest case status folded from event afterState/action (e.g. "closed"). */
  currentStatus: string;
  /** the latest deal status the events carried (newStatus / afterState.dealStatus). */
  dealStatus: string;
  /** the ordered events for this case — the auditable timeline. */
  timeline: SealedAuditEvent[];
  /** whether the backing chain verified (reconstruction trusts only a valid chain). */
  chainValid: true;
}

/**
 * Reconstruct a single case's lifecycle from AuditEvents ALONE (acceptance c).
 *
 * Integrity precedes interpretation: we first `verifyChain` the FULL ledger and
 * throw if it does not verify — you cannot rebuild a trustworthy lifecycle from a
 * tampered log. Then we fold the events scoped to `caseId` into a current-state
 * snapshot, deriving status from each event's `afterState`/status fields and the
 * deal status from `newStatus`. No external case store is consulted — the events
 * are the sole source of truth.
 */
export function reconstructCaseLifecycle(
  events: readonly SealedAuditEvent[],
  caseId: string,
): ReconstructedCase {
  const verdict = verifyChain(events);
  if (!verdict.valid) {
    throw new Error(
      `cannot reconstruct: audit chain is invalid (${verdict.reason ?? "broken chain"})`,
    );
  }

  const timeline = events.filter((e) => e.caseId === caseId);
  if (timeline.length === 0) {
    throw new Error(`no AuditEvents found for case ${caseId}`);
  }

  let currentStatus = "open";
  let dealStatus = timeline[0]!.previousStatus as string;

  for (const e of timeline) {
    // deal status: the newStatus the event recorded is the post-event truth.
    dealStatus = e.newStatus;
    // case status: prefer an explicit afterState.status snapshot; otherwise
    // derive from the named action so the fold works even on lean events.
    const afterStatus = e.afterState?.["status"];
    if (typeof afterStatus === "string") {
      currentStatus = afterStatus;
    } else if (e.action === "case.opened") {
      currentStatus = "open";
    } else if (e.action === "case.closed") {
      currentStatus = "closed";
    } else if (e.action === "correction.enforced" || e.action === "correction-enforced") {
      currentStatus = "corrected";
    }
    // also let an explicit afterState.dealStatus override (richer than newStatus).
    const afterDeal = e.afterState?.["dealStatus"];
    if (typeof afterDeal === "string") dealStatus = afterDeal;
  }

  return {
    caseId,
    dealId: timeline[0]!.dealId,
    currentStatus,
    dealStatus,
    timeline,
    chainValid: true,
  };
}
