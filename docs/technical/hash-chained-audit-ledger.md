# The hash-chained audit ledger

A technical deep dive into one primitive of the Liminal Engine: the append-only,
hash-chained audit ledger that makes the governance trail tamper-evident, and the
canonical JSON hashing that makes its digests reproducible across independent
implementations in TypeScript and Rust.

Everything described here is implemented and tested in this repository. Source files
and test files are linked throughout. Limitations are stated plainly at the end.

## Problem

When organizations hand real work to AI agents, the record of what happened becomes
load-bearing. A governance system that detects a silent miss, enforces a human
correction, and gates a downstream action is only as trustworthy as its trail: if the
trail can be silently edited after the fact, the correction it records is an opinion,
not evidence.

Ordinary application logs fail this bar in three ways:

1. **Mutable storage.** A row in a normal table can be updated or deleted by whoever
   holds write access, including a buggy or compromised process.
2. **Unstable serialization.** `JSON.stringify` output depends on object key insertion
   order, so the "same" event can produce different bytes on different machines,
   making any digest over it unreliable.
3. **No positional integrity.** Even an append-only file does not, by itself, reveal a
   dropped head, a spliced middle, or a reordered tail.

The ledger addresses all three: one sealed writer, canonical serialization, and a
hash chain where every event's position is part of what gets hashed.

## Failure model

The ledger is designed to make the following tamper-evident (detectable on read),
for any actor with write access to the stored events after sealing:

| Attempt | How it is caught |
| --- | --- |
| Edit a sealed event's payload | The event's recomputed hash no longer matches its stored `eventHash` |
| Edit a payload and re-hash it | The next event's `prevHash` no longer links to the recomputed hash |
| Drop the head event | The new head's `prevHash` is not the genesis sentinel |
| Splice or reorder events | The running `prevHash` link breaks at the splice point |
| Interpret a tampered log anyway | Reconstruction refuses to run on a chain that fails verification |

Out of scope, stated honestly: the chain proves integrity, not authorship. It is
hash-chained, not signed. A party who controls the entire chain end to end could
rewrite all of it consistently. See "Known limitations."

## Design

Three functions own the primitive, all in
[`packages/governance/src/audit-ledger.ts`](../../packages/governance/src/audit-ledger.ts):

**1. One sealed writer.** `AuditLedger.append` is the only path that seals an event.
The caller supplies a payload without a chain link; the ledger assigns `prevHash`
(the tail's `eventHash`, or the `GENESIS` sentinel for the first event) and computes
`eventHash`. The chain link is computed, never caller-supplied, and sealed events are
frozen:

```ts
append(input: Omit<AuditEvent, "prevHash">): SealedAuditEvent {
  const tail = this.#chain[this.#chain.length - 1];
  const prevHash = tail ? tail.eventHash : AuditLedger.GENESIS;
  // redact sensitive snapshot fields BEFORE sealing, then validate
  // through the contract so untrusted input never bypasses validation
  const event = auditEventContract.parse(redacted) as AuditEvent;
  const eventHash = hashEvent(event);
  const sealed = Object.freeze({ ...event, eventHash }) as SealedAuditEvent;
  ...
}
```

Two details matter here:

- **`prevHash` is folded inside the hashed payload.** The digest is
  `sha256(canonical_json(payload including prevHash))`, so an event's chain position
  is part of its identity. The head cannot be silently dropped: the next event's
  `prevHash` would fail to match, and a forged head would fail the genesis check.
- **Redaction happens before sealing.** Sensitive snapshot fields are redacted by
  [`redact.ts`](../../packages/governance/src/redact.ts) before the hash is computed,
  so the single writer cannot commit raw sensitive data to the chain, and redaction
  never breaks an already-sealed hash.

**2. A verifier.** `verifyChain` walks the events in order and checks two things at
every node: the stored `prevHash` equals the running expected link, and the stored
`eventHash` equals the recomputed digest. Because each node's expected `prevHash` is
the previous node's recomputed hash, mutating any earlier payload breaks the next
link. Failures pinpoint the index and reason (`brokenAt`, `reason`).

**3. A reconstructor that refuses tampered input.** `reconstructCaseLifecycle`
rebuilds a governance case's lifecycle from audit events alone, with no external
store. It calls `verifyChain` first and throws if the chain does not verify:
integrity precedes interpretation.

```ts
const verdict = verifyChain(events);
if (!verdict.valid) {
  throw new Error(`cannot reconstruct: audit chain is invalid (...)`);
}
```

## Canonical hashing: the digest that ports

The ledger deliberately has no bespoke hashing. It reuses the contract layer's
canonical hash in
[`packages/contracts/src/canonical-hash.ts`](../../packages/contracts/src/canonical-hash.ts):

- **`stableStringify`**: JSON serialization with object keys sorted at every level,
  so the same logical payload always produces the same bytes. Array order is
  preserved intentionally; the canonical projection normalizes any order that should
  not matter.
- **`sha256Hex`**: a pure-JS SHA-256. No `node:crypto`, no `crypto.subtle`, so the
  digest is identical in Node and in a browser or desktop webview.
- **Schema tag in the payload**: the contract's schema string is part of what gets
  hashed, so a v2 contract can never collide with a v1 hash.

The reason for this design is portability across the wider Liminal system. The same
canonicalization discipline is implemented independently in the private Liminal
codebases (a TypeScript substrate library and a Rust desktop implementation), and the
implementations are pinned to each other with golden test vectors: fixed inputs whose
expected digests are committed, so any drift in any implementation fails a test
instead of silently forking the audit trail. Within this repository, contract goldens
are regenerated in CI and checked against the committed vectors.

## Data structures

```ts
interface SealedAuditEvent extends AuditEvent {
  readonly eventHash: string;  // sha256 over the canonical payload (prevHash included)
}

interface ChainVerification {
  valid: boolean;
  length: number;      // events examined
  brokenAt?: number;   // index of the first bad link, when invalid
  reason?: string;     // human-readable failure, when invalid
}
```

`AuditEvent` itself is a zod contract
([`packages/contracts/src/audit-event.contract.ts`](../../packages/contracts/src/audit-event.contract.ts)):
every append validates and normalizes the payload at the writer boundary, so a
malformed event is rejected before it can be sealed. The curated event vocabulary
(`goal.created`, `case.opened`, `correction.proposed`, `correction.enforced`,
`gate.evaluated`, `eval.passed`, `case.closed`, and so on) is exported as
`AUDIT_EVENT_TYPES` so tests assert membership against a single source of truth.

## Lifecycle

A worked pass of the governance loop produces this trail:

```mermaid
flowchart LR
  A[goal.created] --> B[case.opened]
  B --> C[correction.proposed]
  C --> D[correction.enforced]
  D --> E[gate.evaluated]
  E --> F[eval.passed]
  F --> G[case.closed]
```

Each box is one sealed `AuditEvent`; each arrow is a `prevHash` link. Reading the
trail back (for the UI timeline, or for `reconstructCaseLifecycle`) verifies the
whole chain first, then folds the events into current state. Determinism note: the
ledger never reads the clock or RNG. Timestamps and ids are injected by the caller,
which is what keeps replay tests byte-stable.

## Invariants

1. Every sealed event's `eventHash` equals the canonical digest of its own payload,
   `prevHash` included.
2. The first event's `prevHash` is the fixed `GENESIS` sentinel; every later event's
   `prevHash` is the previous event's `eventHash`.
3. There is exactly one writer path (`append`); sealed events are frozen and
   `events()` returns a copy.
4. Key order never changes a hash; array order always does; a schema version bump
   always does.
5. Reconstruction never interprets a chain that fails verification.
6. Redaction runs before sealing, so no post-hoc redaction can break a sealed hash.

## Test evidence

The invariants above are enforced by committed tests, runnable with `pnpm verify`:

- [`packages/governance/src/audit-ledger.test.ts`](../../packages/governance/src/audit-ledger.test.ts):
  genesis anchoring and per-event linking; hash reuse of the contract's canonical
  projection; frozen append-only behavior; a well-formed chain verifies; a tampered
  payload fails with the exact break index; a re-linked splice is still caught;
  lifecycle reconstruction from events alone; reconstruction refuses a tampered
  chain.
- [`packages/contracts/test/canonical-hash.test.ts`](../../packages/contracts/test/canonical-hash.test.ts):
  key-order insensitivity, array-order sensitivity, and SHA-256 known-answer vectors.
- [`packages/governance/src/audit-redaction.test.ts`](../../packages/governance/src/audit-redaction.test.ts)
  and [`packages/governance/src/determinism.test.ts`](../../packages/governance/src/determinism.test.ts):
  redaction-before-sealing and byte-stable replay.

## Known limitations

Stated plainly, because the boundary between what this does and does not prove is
the point of the artifact:

1. **Tamper-evident, not tamper-proof, and not attributable.** SHA-256 chaining
   proves the log you are reading is the log that was written, link by link. It does
   not prove who wrote it. This ledger carries no attributable key-based signing:
   a party controlling the whole store could rewrite the entire chain
   self-consistently. Elsewhere in the product, Ed25519 device signatures are
   implemented for decision packets in the desktop application (device key held in
   the macOS Keychain); binding that signing into this ledger's receipts is the next
   experiment, not a shipped feature of this library. (An earlier revision of this
   section claimed no signing existed anywhere in the codebase; that was incorrect
   and is corrected here.)
2. **In-memory chain, storage-agnostic by design.** `AuditLedger` holds the chain in
   memory and can be rehydrated with `fromEvents`; durable storage is an adapter
   concern behind ports. Durability guarantees are therefore the adapter's, not the
   ledger's.
3. **Anchoring is external.** Publishing a chain head digest to an external witness
   (for example a public chain) is how the "rewrite everything consistently" attack
   gets closed. Liminal has done hash-only anchoring on Algorand TestNet in the
   archived Berlin hackathon submission
   ([algorand-berlin-2026](https://github.com/liminalshruti/algorand-berlin-2026));
   that flow is not wired into this engine.
4. **Multiple canonical-hash implementations exist across the Liminal system.**
   Golden vectors pin them to each other, and that duplication is a deliberate
   short-term trade (each surface stays dependency-free) with a known consolidation
   cost. It is tracked as debt, not denied.

## Next experiments

- Key-attributable signing over sealed events (signature over `eventHash`), so the
  chain proves authorship as well as integrity.
- Periodic chain-head anchoring to an external witness, closing the full-rewrite gap.
- A single vendored canonical-hash implementation consumed by every surface, replacing
  parity-by-golden-test with parity-by-construction.

---

*Part of [Liminal Engine](../../README.md), the governance layer for agentic work.
Liminal is a local-first judgment and control layer for organizations operating with
AI agents; this repository is the public, MIT-licensed engine built at the AI Engineer
World's Fair Hackathon 2026.*
