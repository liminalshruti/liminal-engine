/**
 * RequirementStore — the outbound port the governance use cases depend on to
 * persist a `Requirement` across its proposed → active → rejected/retired
 * lifecycle, and to answer "what is ACTIVELY governing this deal / goal /
 * action-surface right now". Adapters live in `packages/integrations/*` (the
 * in-memory fixture store first); the application never imports a concrete
 * adapter (enforced by `.dependency-cruiser.cjs`).
 *
 * WHY a `Result` return instead of throwing (unlike the sibling ports in
 * `ports.ts`): a governance gate must be able to FAIL CLOSED on a store failure
 * — deny when it cannot confirm the active requirement set. A thrown exception is
 * easy to swallow and silently turn into a fail-OPEN; a representable typed error
 * forces the caller to handle the failure branch. So every method returns a
 * `Result<T, RequirementStoreError>`: a store failure is DATA the caller must
 * branch on, not control flow it can ignore. (`failClosed` below codifies the
 * safe read; mirrors `proxy-gate`'s fail-closed verdict at the requirement layer.)
 *
 * Identity + time are INJECTED into the adapter (a `Clock`/`IdGen`, the same
 * deterministic seam the loop uses) — never `Date.now()`/`Math.random()` — so the
 * store reproduces the locked Acme fixtures byte-for-byte when seeded.
 */
import type { Requirement, RequirementStatus } from "@liminal-engine/contracts";

/**
 * The content a caller supplies to create a requirement. The store assigns the
 * identity (`id`), the `createdAt` timestamp and the initial `proposed` status —
 * `approvedBy`/`activatedAt` are set only on approval — so a caller cannot forge
 * an already-"active" (already-approved) requirement past the store's lifecycle.
 */
export type RequirementDraft = Omit<
  Requirement,
  "id" | "status" | "createdAt" | "activatedAt" | "approvedBy"
>;

/**
 * The content fields a version update (`amend`) may revise. Identity / ownership
 * (`id`, `goalId`, `dealId`, `createdBy`, `createdAt`) and lifecycle metadata
 * (`status`, `approvedBy`, `activatedAt`) are NOT caller-revisable here — they are
 * managed by the transitions so the append-only history stays trustworthy.
 */
export type RequirementAmendment = Partial<
  Pick<Requirement, "text" | "ownerRole" | "severity" | "scope" | "evidenceRefs">
>;

/** Why a store operation could not be completed — REPRESENTABLE, never thrown. */
export type RequirementStoreErrorCode =
  | "not_found" // no requirement carries that id
  | "invalid_transition" // the lifecycle move is illegal from the current status
  | "duplicate" // create produced an id that already exists (idgen/seed collision)
  | "validation" // the resulting record violates the Requirement contract
  | "store_unavailable"; // the backing store itself failed — the fail-closed signal

export interface RequirementStoreError {
  readonly code: RequirementStoreErrorCode;
  readonly message: string;
  /** the requirement id the failed op targeted, when applicable. */
  readonly id?: string;
  /** for `invalid_transition`: the status found, and the status requested. */
  readonly from?: RequirementStatus;
  readonly to?: RequirementStatus;
}

/** A fallible result — `ok` discriminates success (`value`) from failure (`error`). */
export type Result<T, E = RequirementStoreError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface RequirementStore {
  /** create → `proposed`. Assigns `id` + `createdAt` via the injected IdGen/Clock. */
  create(draft: RequirementDraft): Promise<Result<Requirement>>;
  /** approve a `proposed` requirement → `active` (sets `approvedBy` + `activatedAt`). */
  approve(id: string, approvedBy: string): Promise<Result<Requirement>>;
  /** reject a `proposed` candidate → `rejected` (terminal, non-governing). */
  reject(id: string): Promise<Result<Requirement>>;
  /** retire an `active` requirement → `retired` (terminal, non-governing). */
  retire(id: string): Promise<Result<Requirement>>;
  /**
   * version update — APPEND a revised record for an existing (non-terminal)
   * requirement. Never mutates the prior (approved) payload; the old version
   * stays frozen in `history`. Lifecycle state carries forward (an authorized
   * revision by the owning role).
   */
  amend(id: string, changes: RequirementAmendment): Promise<Result<Requirement>>;

  /** the current (latest) snapshot for a requirement id, whatever its status. */
  get(id: string): Promise<Result<Requirement>>;
  /** the full append-only version history for an id, oldest → newest (immutable). */
  history(id: string): Promise<Result<readonly Requirement[]>>;

  /** ACTIVE requirements governing a deal (excludes proposed/rejected/retired). */
  activeByDeal(dealId: string): Promise<Result<readonly Requirement[]>>;
  /** ACTIVE requirements governing a goal (excludes proposed/rejected/retired). */
  activeByGoal(goalId: string): Promise<Result<readonly Requirement[]>>;
  /** ACTIVE requirements whose `scope` governs a given action / output surface. */
  activeByScope(surface: string): Promise<Result<readonly Requirement[]>>;
}

/**
 * The outcome of a fail-closed read: either `proceed` with the value, or refuse
 * (`proceed: false`) with a reason. Deliberately NOT a bare value so a caller
 * cannot forget the failure branch and fail open.
 */
export type FailClosed<T> =
  | { readonly proceed: true; readonly value: T }
  | { readonly proceed: false; readonly reason: string };

/**
 * Fail-closed read of a store `Result`: on ANY store error, do NOT proceed — the
 * caller (e.g. an action gate) should DENY rather than act on an unknown
 * governance state. Codifies the acceptance criterion "a gate can fail CLOSED on
 * store failure" as a reusable, tested combinator rather than prose.
 */
export function failClosed<T>(result: Result<T>): FailClosed<T> {
  if (result.ok) return { proceed: true, value: result.value };
  return {
    proceed: false,
    reason: `requirement store failed — failing closed (${result.error.code}): ${result.error.message}`,
  };
}
