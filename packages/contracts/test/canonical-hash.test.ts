import { test } from "node:test";
import assert from "node:assert/strict";
import { stableStringify, sha256Hex, canonicalHash } from "../src/canonical-hash.ts";

test("INVARIANT 1: object key order does not change the hash", () => {
  const a = { schema: "x.v1", b: 1, a: 2, nested: { z: 1, y: 2 } };
  const b = { nested: { y: 2, z: 1 }, a: 2, b: 1, schema: "x.v1" };
  assert.equal(canonicalHash(a), canonicalHash(b));
});

test("INVARIANT 2: array order DOES change the hash", () => {
  assert.notEqual(canonicalHash({ xs: [1, 2, 3] }), canonicalHash({ xs: [3, 2, 1] }));
});

test("INVARIANT 3: schema tag is part of the hash (v1 vs v2 cannot collide)", () => {
  assert.notEqual(canonicalHash({ schema: "x.v1", v: 1 }), canonicalHash({ schema: "x.v2", v: 1 }));
});

test("sha256Hex matches a known vector (empty string)", () => {
  // Standard SHA-256 of "" — proves the pure-JS impl is real SHA-256.
  assert.equal(
    sha256Hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

test("sha256Hex matches a known vector (abc)", () => {
  assert.equal(
    sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("stableStringify sorts keys and preserves array order", () => {
  assert.equal(stableStringify({ b: 1, a: [3, 1, 2] }), '{"a":[3,1,2],"b":1}');
});
