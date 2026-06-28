/**
 * RequirementStore adapter — in-memory FIXTURE STUB. Holds requirements across
 * the proposed → active → rejected/retired lifecycle with an APPEND-ONLY,
 * immutable version history: every transition or amendment PUSHES a new
 * deep-frozen snapshot, and a historical (esp. approved) payload is never mutated
 * in place. The latest snapshot per id is "current"; active queries read current.
 *
 * Deterministic: ids and timestamps come from the injected `IdGen`/`Clock` (the
 * same seam the governance loop uses) — no `Date.now()`/randomness — so a seeded
 * store reproduces the locked Acme fixtures byte-for-byte. A persistent,
 * receipt-anchored store is a stretch goal behind this same port.
 *
 * Errors are REPRESENTABLE (`Result`, never thrown) so a downstream gate can fail
 * CLOSED on store failure — even an unexpected internal fault is caught and
 * returned as a `store_unavailable` Result rather than propagated. Untrusted
 * input is validated through `requirementContract` (the contract's sanctioned
 * boundary parse) so a malformed record surfaces as a `validation` Result, never
 * a thrown exception or a corrupt entry in history.
 *
 * Implements @liminal-engine/governance's `RequirementStore`.
 */
import {
  requirementContract,
  type Requirement,
  type RequirementStatus,
} from "@liminal-engine/contracts";
import type {
  Clock,
  IdGen,
  RequirementAmendment,
  RequirementDraft,
  RequirementStore,
  RequirementStoreError,
  Result,
} from "@liminal-engine/governance";

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}
function err(error: RequirementStoreError): Result<never> {
  return { ok: false, error };
}

/**
 * Recursively freeze a snapshot so a stored (esp. approved) payload — and its
 * nested `scope`/`evidenceRefs` arrays — can never be mutated in place. This is
 * the immutable-history guarantee enforced at runtime, not just by convention.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/** Drop `undefined`-valued keys so an amendment never overwrites a field with `undefined`. */
function definedOnly<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

/** Statuses a requirement can no longer leave — it neither governs nor transitions. */
const TERMINAL: ReadonlySet<RequirementStatus> = new Set<RequirementStatus>(["rejected", "retired"]);

export class InMemoryRequirementStore implements RequirementStore {
  /**
   * APPEND-ONLY log of immutable snapshots — never reordered, never mutated, only
   * grown. Each entry is a deep-frozen `Requirement`; the LAST entry for a given
   * id is its current version/status (later index ⇒ newer).
   */
  private readonly versions: Requirement[] = [];
  private readonly clock: Clock;
  private readonly idGen: IdGen;

  constructor(clock: Clock, idGen: IdGen) {
    this.clock = clock;
    this.idGen = idGen;
  }

  async create(draft: RequirementDraft): Promise<Result<Requirement>> {
    return this.guard(() => {
      const id = this.idGen.next();
      if (this.current(id) !== undefined) {
        return err({ code: "duplicate", id, message: `a requirement with id "${id}" already exists` });
      }
      return this.append({
        ...draft,
        id,
        status: "proposed",
        createdAt: this.clock.now(),
      });
    });
  }

  async approve(id: string, approvedBy: string): Promise<Result<Requirement>> {
    return this.guard(() => {
      const current = this.current(id);
      if (current === undefined) return notFound(id);
      if (current.status !== "proposed") {
        return invalidTransition(id, current.status, "active", "approve", "proposed");
      }
      return this.append({
        ...current,
        status: "active",
        approvedBy,
        activatedAt: this.clock.now(),
      });
    });
  }

  async reject(id: string): Promise<Result<Requirement>> {
    return this.guard(() => {
      const current = this.current(id);
      if (current === undefined) return notFound(id);
      if (current.status !== "proposed") {
        return invalidTransition(id, current.status, "rejected", "reject", "proposed");
      }
      return this.append({ ...current, status: "rejected" });
    });
  }

  async retire(id: string): Promise<Result<Requirement>> {
    return this.guard(() => {
      const current = this.current(id);
      if (current === undefined) return notFound(id);
      if (current.status !== "active") {
        return invalidTransition(id, current.status, "retired", "retire", "active");
      }
      return this.append({ ...current, status: "retired" });
    });
  }

  async amend(id: string, changes: RequirementAmendment): Promise<Result<Requirement>> {
    return this.guard(() => {
      const current = this.current(id);
      if (current === undefined) return notFound(id);
      if (TERMINAL.has(current.status)) {
        return err({
          code: "invalid_transition",
          id,
          from: current.status,
          message: `cannot amend a ${current.status} requirement — it is terminal`,
        });
      }
      // A version update: apply the content changes onto the current snapshot and
      // APPEND it as a new record. Lifecycle state (status/approvedBy/activatedAt)
      // carries forward; the prior snapshot stays frozen in history.
      return this.append({ ...current, ...definedOnly(changes) });
    });
  }

  async get(id: string): Promise<Result<Requirement>> {
    return this.guard(() => {
      const current = this.current(id);
      return current === undefined ? notFound(id) : ok(current);
    });
  }

  async history(id: string): Promise<Result<readonly Requirement[]>> {
    return this.guard(() => {
      const versions = this.versions.filter((v) => v.id === id);
      if (versions.length === 0) return notFound(id);
      // a fresh array of frozen snapshots, oldest → newest — callers cannot touch
      // the internal log, and the snapshots themselves are immutable.
      return ok(versions);
    });
  }

  async activeByDeal(dealId: string): Promise<Result<readonly Requirement[]>> {
    return this.guard(() => ok(this.active((r) => r.dealId === dealId)));
  }

  async activeByGoal(goalId: string): Promise<Result<readonly Requirement[]>> {
    return this.guard(() => ok(this.active((r) => r.goalId === goalId)));
  }

  async activeByScope(surface: string): Promise<Result<readonly Requirement[]>> {
    return this.guard(() => ok(this.active((r) => r.scope.includes(surface))));
  }

  // — internals —————————————————————————————————————————————————————————————

  /** The latest snapshot for an id (append-only ⇒ scan from the newest end). */
  private current(id: string): Requirement | undefined {
    for (let i = this.versions.length - 1; i >= 0; i--) {
      const v = this.versions[i]!;
      if (v.id === id) return v;
    }
    return undefined;
  }

  /** Current ACTIVE snapshots (latest per id) matching a predicate. */
  private active(match: (r: Requirement) => boolean): Requirement[] {
    const byId = new Map<string, Requirement>();
    for (const v of this.versions) byId.set(v.id, v); // last write wins ⇒ current
    return [...byId.values()].filter((r) => r.status === "active" && match(r));
  }

  /**
   * Validate a constructed record through the Requirement contract (the sanctioned
   * boundary parse), then APPEND a deep-frozen copy. A malformed record is
   * returned as a `validation` Result and is NOT appended — history only ever
   * holds contract-valid, immutable snapshots.
   */
  private append(record: Requirement): Result<Requirement> {
    const parsed = requirementContract.safeParse(record);
    if (!parsed.success) {
      return err({
        code: "validation",
        id: record.id,
        message: `requirement violates its contract: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      });
    }
    // zod returns a fresh, validated object (and fresh nested arrays), so freezing
    // it cannot mutate the caller's input.
    const snapshot = deepFreeze(parsed.data);
    this.versions.push(snapshot);
    return ok(snapshot);
  }

  /**
   * Run a store operation, converting ANY unexpected throw into a representable
   * `store_unavailable` Result. Guarantees the adapter NEVER throws — a caller can
   * always branch on `Result.ok` and fail closed (it never has to wrap calls in
   * try/catch to stay safe).
   */
  private async guard<T>(op: () => Result<T>): Promise<Result<T>> {
    try {
      return op();
    } catch (error) {
      return err({
        code: "store_unavailable",
        message: `requirement store failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
}

function notFound(id: string): Result<never> {
  return err({ code: "not_found", id, message: `no requirement with id "${id}"` });
}

function invalidTransition(
  id: string,
  from: RequirementStatus,
  to: RequirementStatus,
  verb: string,
  requiredFrom: RequirementStatus,
): Result<never> {
  return err({
    code: "invalid_transition",
    id,
    from,
    to,
    message: `cannot ${verb} a ${from} requirement (only ${requiredFrom} → ${to})`,
  });
}
