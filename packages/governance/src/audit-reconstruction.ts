/**
 * Audit reconstruction — the RICH case-lifecycle rebuild over a verified chain.
 *
 * The chain itself (hashing, genesis link, tamper-evidence) is owned by
 * `audit-ledger.ts` (LIM-1229): one hash scheme, one append-only writer. This
 * module does NOT re-implement hashing or verification — it consumes the ledger's
 * `verifyChain` / `SealedAuditEvent` and layers the demo-proof reconstruction on
 * top: full GovernanceCase snapshots, status transitions, and the lifecycle the
 * audit-completeness claim (beat #11 / MNC#6) asserts against.
 *
 * Integrity precedes interpretation: reconstruction first verifies the FULL chain
 * via the ledger and refuses to rebuild a lifecycle from a tampered log.
 */
import {
  governanceCaseContract,
  type GovernanceCase,
  type GovernanceCaseStatus,
} from "@liminal-engine/contracts";
import {
  verifyChain,
  type ChainVerification,
  type SealedAuditEvent,
} from "./audit-ledger.ts";

export interface GovernanceCaseTransition {
  readonly eventId: string;
  readonly action: string;
  readonly recordedAt: string;
  readonly fromStatus?: GovernanceCaseStatus;
  readonly toStatus: GovernanceCaseStatus;
}

export interface ReconstructedGovernanceCase {
  readonly caseId: string;
  readonly dealId: string;
  readonly current: GovernanceCase;
  readonly lifecycleStatuses: readonly GovernanceCaseStatus[];
  readonly transitions: readonly GovernanceCaseTransition[];
  readonly eventIds: readonly string[];
  readonly actionIds: readonly string[];
  readonly evalIds: readonly string[];
  /** the eventHash of the verified chain's head (tail) event — the chain anchor. */
  readonly chainHeadHash?: string;
}

/**
 * Rebuild a single case's full lifecycle from the SEALED AuditEvents alone.
 *
 * The chain is verified through the ledger (`verifyChain`) — the same hash/genesis
 * scheme used to write it — so this never re-derives hashes. On a tampered chain
 * it throws with the ledger's pinpointed reason. Then it folds the case-scoped
 * events into a current-state snapshot, validating that each event's `beforeState`
 * matches the reconstructed prior state (so the snapshots themselves are a
 * coherent timeline, not just a valid hash chain).
 */
export function reconstructCaseLifecycleFromEvents(
  events: readonly SealedAuditEvent[],
  caseId: string,
): ReconstructedGovernanceCase {
  const chain = verifyChain(events);
  if (!chain.valid) {
    throw new Error(
      `audit chain invalid at index ${chain.brokenAt ?? "?"}: ${chain.reason ?? "broken chain"}`,
    );
  }

  const caseEvents = events.filter((event) => event.caseId === caseId);
  if (caseEvents.length === 0) {
    throw new Error(`no audit events found for case ${caseId}`);
  }

  let current: GovernanceCase | undefined;
  let dealId: string | undefined;
  const lifecycleStatuses: GovernanceCaseStatus[] = [];
  const transitions: GovernanceCaseTransition[] = [];
  const eventIds: string[] = [];
  const actionIds = new Set<string>();
  const evalIds = new Set<string>();

  for (const event of caseEvents) {
    if (dealId !== undefined && event.dealId !== dealId) {
      throw new Error(`case ${caseId} spans multiple deals in audit events`);
    }
    dealId = event.dealId;

    const before = readCaseSnapshot(event.beforeState);
    const after = readCaseSnapshot(event.afterState);
    if (!after) {
      throw new Error(`audit event ${event.id} is missing afterState.governanceCase`);
    }
    if (after.id !== caseId) {
      throw new Error(`audit event ${event.id} snapshot belongs to case ${after.id}, not ${caseId}`);
    }
    if (after.dealId !== event.dealId) {
      throw new Error(`audit event ${event.id} snapshot deal ${after.dealId} does not match event deal ${event.dealId}`);
    }
    if (current && !before) {
      throw new Error(`audit event ${event.id} is missing beforeState.governanceCase`);
    }
    if (current && before && governanceCaseContract.hash(before) !== governanceCaseContract.hash(current)) {
      throw new Error(`audit event ${event.id} beforeState does not match the reconstructed prior case state`);
    }

    transitions.push({
      eventId: event.id,
      action: event.action,
      recordedAt: event.recordedAt,
      fromStatus: before?.status,
      toStatus: after.status,
    });
    if (lifecycleStatuses[lifecycleStatuses.length - 1] !== after.status) {
      lifecycleStatuses.push(after.status);
    }

    eventIds.push(event.id);
    for (const actionId of event.actionIds ?? []) actionIds.add(actionId);
    for (const evalId of event.evalIds ?? []) evalIds.add(evalId);
    current = after;
  }

  if (!current || !dealId) {
    throw new Error(`no reconstructable GovernanceCase snapshots found for case ${caseId}`);
  }

  return {
    caseId,
    dealId,
    current,
    lifecycleStatuses,
    transitions,
    eventIds,
    actionIds: [...actionIds],
    evalIds: [...evalIds],
    chainHeadHash: chainHeadHash(events, chain),
  };
}

/** The eventHash of the verified chain's tail — the anchor a verifier pins to. */
function chainHeadHash(
  events: readonly SealedAuditEvent[],
  chain: ChainVerification,
): string | undefined {
  if (!chain.valid || events.length === 0) return undefined;
  return events[events.length - 1]!.eventHash;
}

function readCaseSnapshot(state: Record<string, unknown> | undefined): GovernanceCase | undefined {
  if (!state || state.governanceCase === undefined) return undefined;
  return governanceCaseContract.parse(state.governanceCase);
}
