/**
 * Audit reconstruction support for tests and demo proof surfaces.
 *
 * The verifier treats AuditEvents as the source of truth: every payload is
 * contract-validated, each event's prevHash must match the canonical hash of the
 * previous event, and reconstruction applies only GovernanceCase snapshots found
 * in the event stream.
 */
import {
  auditEventContract,
  governanceCaseContract,
  sha256Hex,
  stableStringify,
  type AuditEvent,
  type GovernanceCase,
  type GovernanceCaseStatus,
} from "@liminal-engine/contracts";

export interface AuditChainLink {
  readonly eventId: string;
  readonly prevHash?: string;
  readonly eventHash: string;
}

export interface AuditChainError {
  readonly code: "prev-hash-mismatch";
  readonly eventId: string;
  readonly index: number;
  readonly expectedPrevHash?: string;
  readonly actualPrevHash?: string;
}

export interface AuditChainVerification {
  readonly ok: boolean;
  readonly headHash?: string;
  readonly links: readonly AuditChainLink[];
  readonly error?: AuditChainError;
}

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
  readonly chainHeadHash?: string;
}

export function hashAuditEvent(event: AuditEvent): string {
  const parsed = auditEventContract.parse(event);
  return sha256Hex(`${parsed.prevHash ?? ""}${stableStringify(auditEventContract.canonical(parsed))}`);
}

export function verifyAuditChain(events: readonly AuditEvent[]): AuditChainVerification {
  let expectedPrevHash: string | undefined;
  const links: AuditChainLink[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = auditEventContract.parse(events[index]);
    if (event.prevHash !== expectedPrevHash) {
      return {
        ok: false,
        headHash: expectedPrevHash,
        links,
        error: {
          code: "prev-hash-mismatch",
          eventId: event.id,
          index,
          expectedPrevHash,
          actualPrevHash: event.prevHash,
        },
      };
    }

    const eventHash = hashAuditEvent(event);
    links.push({ eventId: event.id, prevHash: event.prevHash, eventHash });
    expectedPrevHash = eventHash;
  }

  return { ok: true, headHash: expectedPrevHash, links };
}

export function reconstructCaseLifecycleFromEvents(
  events: readonly AuditEvent[],
  caseId: string,
): ReconstructedGovernanceCase {
  const chain = verifyAuditChain(events);
  if (!chain.ok) {
    const error = chain.error;
    throw new Error(
      error
        ? `audit chain invalid at event ${error.eventId}: expected prevHash ${formatHash(error.expectedPrevHash)}, got ${formatHash(error.actualPrevHash)}`
        : "audit chain invalid",
    );
  }

  const caseEvents = events
    .map((event) => auditEventContract.parse(event))
    .filter((event) => event.caseId === caseId);

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
    chainHeadHash: chain.headHash,
  };
}

function readCaseSnapshot(state: Record<string, unknown> | undefined): GovernanceCase | undefined {
  if (!state || state.governanceCase === undefined) return undefined;
  return governanceCaseContract.parse(state.governanceCase);
}

function formatHash(hash: string | undefined): string {
  return hash ?? "<genesis>";
}
