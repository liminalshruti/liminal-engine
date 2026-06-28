import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GeminiAgentOutputSource,
  GeminiCacheMiss,
  cacheKeyFor,
  type AgentInput,
} from "./index.ts";

// The adapter resolves its cache dir relative to its own module file. To test cache HITS
// deterministically without the network, we write a real-shaped AgentOutput at the exact key
// the adapter will look up, into the adapter's cache dir. (We import the dir via the same key
// math the adapter uses, so the test can never drift from the implementation.)
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

const input: AgentInput = {
  dealId: "acme_expansion",
  dealName: "Acme expansion",
  transcript: "Customer stated EU data residency is a hard gating requirement for the pilot.",
  artifacts: ["customer-call", "proposal", "launch-plan"],
};

function captured(passNumber: number, dropped: string[]): unknown {
  return {
    id: `ao_test_p${passNumber}`,
    dealId: input.dealId,
    dealName: input.dealName,
    passNumber,
    reportedStatus: dropped.length > 0 ? "on-track" : "at-risk",
    summary: passNumber === 1 ? "Expansion on track." : "At risk until EU residency has an owner.",
    droppedRequirements: dropped,
    agentMetadata: { agent: "Gemini", model: MODEL, artifacts: input.artifacts },
  };
}

// cache dir = packages/integrations/gemini/cache (sibling of src/) — same as the adapter.
const CACHE_DIR = join(import.meta.dirname, "..", "cache");

async function seedCache(): Promise<string[]> {
  await mkdir(CACHE_DIR, { recursive: true });
  const written: string[] = [];
  for (const [pass, dropped] of [[1, ["EU data residency"]], [2, []]] as const) {
    const key = cacheKeyFor(MODEL, input.transcript, pass);
    const path = join(CACHE_DIR, `${key}.json`);
    await writeFile(path, JSON.stringify(captured(pass, [...dropped]), null, 2), "utf8");
    written.push(path);
  }
  return written;
}

test("cache HIT: replays a real captured AgentOutput offline (no key, no network)", async () => {
  const written = await seedCache();
  try {
    delete process.env.GEMINI_API_KEY; // prove replay needs no key
    const source = new GeminiAgentOutputSource();
    source.register(input);

    const pass1 = await source.getOutput(input.dealId, 1);
    assert.equal(pass1.reportedStatus, "on-track");
    assert.deepEqual(pass1.droppedRequirements, ["EU data residency"]); // the false green
    assert.ok(pass1.agentMetadata, "agentMetadata present (provenance of the captured call)");
    assert.equal(pass1.agentMetadata.agent, "Gemini");

    const pass2 = await source.getOutput(input.dealId, 2);
    assert.equal(pass2.reportedStatus, "at-risk");
    assert.deepEqual(pass2.droppedRequirements, []); // corrected
  } finally {
    await Promise.all(written.map((p) => rm(p, { force: true })));
  }
});

test("cache MISS + no key: throws GeminiCacheMiss — NEVER fabricates output", async () => {
  delete process.env.GEMINI_API_KEY;
  const source = new GeminiAgentOutputSource();
  source.register({ ...input, transcript: "a totally different, uncached transcript" });
  await assert.rejects(() => source.getOutput(input.dealId, 1), GeminiCacheMiss);
});

test("getOutput requires a registered input (no silent default subject)", async () => {
  delete process.env.GEMINI_API_KEY;
  const source = new GeminiAgentOutputSource();
  await assert.rejects(() => source.getOutput("unregistered_deal", 1), /no input registered/);
});

test("cache key is bound to model + pass + transcript (replay can't cross inputs)", () => {
  const a = cacheKeyFor(MODEL, "transcript A", 1);
  const b = cacheKeyFor(MODEL, "transcript B", 1);
  const c = cacheKeyFor(MODEL, "transcript A", 2);
  assert.notEqual(a, b); // different input → different key
  assert.notEqual(a, c); // different pass → different key
  assert.match(a, /^[0-9a-f]{64}$/);
});
