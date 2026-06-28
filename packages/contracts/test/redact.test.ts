/**
 * redact primitive tests (LIM-1248) — the data-boundary / redaction helper.
 *
 * Pins that a sensitive value maps to a non-reversible reference built from the
 * EXISTING canonical hash (no bespoke hash), that the reference carries no raw
 * value, that it round-trips through `verifyRedaction`, and that it is idempotent
 * and deterministic. The sha256 digest is golden-pinned to a literal so a silent
 * change to the hashing path fails here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalHash,
  stableStringify,
  redact,
  isRedactedRef,
  verifyRedaction,
  REDACTION_SCHEME,
  type RedactedRef,
} from "../src/index.ts";

const SECRET = "EU data residency";

test("redact maps a value to a reference whose digest IS the existing canonical hash (no bespoke hash)", () => {
  const ref = redact(SECRET, "requirement");
  assert.equal(ref.redacted, true);
  assert.equal(ref.scheme, REDACTION_SCHEME);
  assert.equal(ref.label, "requirement");
  // reuses canonicalHash verbatim — not a new hash invented here
  assert.equal(ref.hash, canonicalHash(SECRET));
  // golden: the digest is byte-stable (a change to the hashing path fails here)
  assert.equal(ref.hash, "a76e6f878662d43d293efd26acd7c1ffccf6bce343eee2de83ef8d22ce1e26d0");
  assert.match(ref.hash, /^[0-9a-f]{64}$/);
});

test("a redacted reference NEVER carries the raw value", () => {
  const ref = redact(SECRET, "requirement");
  // the raw secret must not be embedded anywhere in the reference
  assert.ok(!stableStringify(ref).includes(SECRET));
  // the reference exposes only marker + scheme + hash + (non-sensitive) label
  assert.deepEqual(Object.keys(ref).sort(), ["hash", "label", "redacted", "scheme"]);
});

test("label is omitted when not provided (kept out of the projection, not set to undefined)", () => {
  const ref = redact(SECRET);
  assert.equal("label" in ref, false);
});

test("verifyRedaction proves a reference matches its raw value — and rejects any other", () => {
  const ref = redact(SECRET);
  assert.equal(verifyRedaction(ref, SECRET), true);
  assert.equal(verifyRedaction(ref, "GDPR"), false);
  assert.equal(verifyRedaction(ref, SECRET + " "), false);
});

test("redact is idempotent — redacting a reference returns it unchanged (no double hashing)", () => {
  const once = redact(SECRET, "requirement");
  const twice = redact(once, "requirement");
  assert.deepEqual(twice, once);
  // even without a label argument, an existing reference is returned as-is
  assert.deepEqual(redact(once), once);
});

test("redact is deterministic — same value yields the same reference every time", () => {
  assert.deepEqual(redact(SECRET, "x"), redact(SECRET, "x"));
});

test("redact handles structured values via the canonical projection (key order independent)", () => {
  const a = redact({ region: "eu", tier: "gold" });
  const b = redact({ tier: "gold", region: "eu" });
  // canonicalHash sorts keys, so logically-equal objects hash identically
  assert.equal(a.hash, b.hash);
});

test("isRedactedRef recognizes references and rejects look-alikes", () => {
  assert.equal(isRedactedRef(redact(SECRET)), true);
  assert.equal(isRedactedRef({ redacted: true }), false);
  assert.equal(isRedactedRef({ redacted: true, scheme: "other", hash: "x" }), false);
  assert.equal(isRedactedRef(SECRET), false);
  assert.equal(isRedactedRef(null), false);
  const notARef: unknown = { redacted: false };
  assert.equal(isRedactedRef(notARef), false);
});

test("RedactedRef is structurally what callers can persist + display", () => {
  const ref: RedactedRef = redact(SECRET, "requirement");
  assert.equal(typeof ref.hash, "string");
  assert.equal(ref.scheme, "canonical-sha256");
});
