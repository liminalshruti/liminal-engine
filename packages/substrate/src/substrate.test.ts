import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemorySubstrate } from "./substrate.ts";

test("ingest an arbitrary stream, then read it back from the substrate", () => {
  const substrate = new InMemorySubstrate();

  const stream = substrate.ingest({
    sourceType: "call-transcript",
    title: "Acme discovery call",
    content: "Customer: we will only pilot if you support EU data residency.",
    provenance: "pinned",
  });

  // ingest assigns an id and returns the stored stream
  assert.ok(stream.id.length > 0, "ingested stream gets an id");
  assert.equal(stream.sourceType, "call-transcript");

  // the stream is now in the substrate
  const all = substrate.streams();
  assert.equal(all.length, 1);
  assert.equal(all[0]!.content, "Customer: we will only pilot if you support EU data residency.");
});
