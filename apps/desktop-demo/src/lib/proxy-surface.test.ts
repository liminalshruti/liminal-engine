import { test } from "node:test";
import assert from "node:assert/strict";
import { llmRequestContract } from "@liminal-engine/contracts";
import {
  DEFAULT_MISSION,
  DEFAULT_MODEL_POLICIES,
  DEFAULT_PROXY_REQUESTS,
  evaluateProxy,
  isMissionAligned,
  parseProxyRequest,
  proposePolicies,
  proposePoliciesLive,
  ratifyProposal,
  recordProxy,
  toLlmRequest,
  type ProxyRequestDraft,
} from "./proxy-surface.ts";

function draft(id: string): ProxyRequestDraft {
  const found = DEFAULT_PROXY_REQUESTS.find((request) => request.id === id);
  assert.ok(found, `missing fixture ${id}`);
  return found;
}

test("each captured request round-trips through the canonical LlmRequest contract", () => {
  for (const d of DEFAULT_PROXY_REQUESTS) {
    const request = toLlmRequest(d, true);
    assert.equal(llmRequestContract.parse(request).id, d.id);
    assert.equal(request.provider, "anthropic");
  }
});

test("parseProxyRequest rejects an unknown model tier", () => {
  const result = parseProxyRequest({ ...DEFAULT_PROXY_REQUESTS[0]!, model: "gpt" as never });
  assert.equal(result.ok, false);
});

test("a governed workstream allows the model it permits (SSO may use Opus)", () => {
  const e = evaluateProxy(draft("req_sso_opus"), DEFAULT_MODEL_POLICIES, DEFAULT_MISSION);
  assert.equal(e.verdict, "allow");
  assert.equal(e.effectiveModel, "opus");
  assert.equal(e.matchedPolicy?.id, "mp_sso_opus");
});

test("calendar Opus is transformed down to Haiku (only-haiku-for-calendar)", () => {
  const e = evaluateProxy(draft("req_cal_opus"), DEFAULT_MODEL_POLICIES, DEFAULT_MISSION);
  assert.equal(e.verdict, "transform");
  assert.equal(e.requestedModel, "opus");
  assert.equal(e.effectiveModel, "haiku");
  assert.match(e.transformNote ?? "", /Opus.*Haiku/);
});

test("billing Opus is transformed down to the most-capable allowed (Sonnet)", () => {
  const e = evaluateProxy(draft("req_billing_opus"), DEFAULT_MODEL_POLICIES, DEFAULT_MISSION);
  assert.equal(e.verdict, "transform");
  assert.equal(e.effectiveModel, "sonnet");
});

test("an off-mission workstream is denied regardless of model", () => {
  const e = evaluateProxy(draft("req_crypto_sonnet"), DEFAULT_MODEL_POLICIES, DEFAULT_MISSION);
  assert.equal(e.verdict, "deny");
  assert.equal(e.missionAligned, false);
  assert.match(e.reasons[0] ?? "", /Off-mission/);
});

test("an on-mission ungoverned workstream is forwarded by default", () => {
  const e = evaluateProxy(draft("req_rel_haiku"), DEFAULT_MODEL_POLICIES, DEFAULT_MISSION);
  assert.equal(e.verdict, "allow");
  assert.equal(e.matchedPolicy, null);
  assert.equal(isMissionAligned(draft("req_rel_haiku"), DEFAULT_MISSION), true);
});

test("self-learning proposer flags Opus overuse on ungoverned developer docs", () => {
  const proposals = proposePolicies(DEFAULT_PROXY_REQUESTS, DEFAULT_MODEL_POLICIES, DEFAULT_MISSION, "2026-06-28T18:00:00.000Z");
  const docs = proposals.find((p) => p.policy.workstream === "Developer docs");
  assert.ok(docs, "should propose a developer-docs routing policy");
  assert.deepEqual(docs.policy.allowedTiers, ["haiku"]);
  assert.ok((docs.savingsPct ?? 0) > 80);
  assert.equal(docs.evidenceRequestIds.length, 2);

  const mission = proposals.find((p) => p.kind === "mission-alignment");
  assert.ok(mission, "should propose a mission-alignment hold for the crypto workstream");
  assert.equal(mission.policy.workstream, "Crypto trading bot");
});

test("ratifying a proposed docs policy closes the loop — the next docs Opus call is transformed", () => {
  const proposals = proposePolicies(DEFAULT_PROXY_REQUESTS, DEFAULT_MODEL_POLICIES, DEFAULT_MISSION, "2026-06-28T18:00:00.000Z");
  const docsProposal = proposals.find((p) => p.policy.workstream === "Developer docs");
  assert.ok(docsProposal);
  const ratified = ratifyProposal(docsProposal);
  assert.equal(ratified.status, "active");

  const before = evaluateProxy(draft("req_docs_opus_1"), DEFAULT_MODEL_POLICIES, DEFAULT_MISSION);
  assert.equal(before.verdict, "allow");
  const after = evaluateProxy(draft("req_docs_opus_1"), [...DEFAULT_MODEL_POLICIES, ratified], DEFAULT_MISSION);
  assert.equal(after.verdict, "transform");
  assert.equal(after.effectiveModel, "haiku");
});

test("proposePoliciesLive falls back to the deterministic proposer when the proxy is offline", async () => {
  const failingFetch: typeof fetch = async () => {
    throw new Error("ECONNREFUSED");
  };
  const result = await proposePoliciesLive(DEFAULT_PROXY_REQUESTS, DEFAULT_MODEL_POLICIES, DEFAULT_MISSION, "2026-06-28T18:00:00.000Z", { fetch: failingFetch, proxyUrl: "http://localhost:8787" });
  assert.equal(result.source, "local");
  assert.ok(result.proposals.length > 0);
});

test("recorded proxy verdicts append to a valid tamper-evident audit chain", () => {
  const a = evaluateProxy(draft("req_cal_opus"), DEFAULT_MODEL_POLICIES, DEFAULT_MISSION);
  const b = evaluateProxy(draft("req_crypto_sonnet"), DEFAULT_MODEL_POLICIES, DEFAULT_MISSION);
  const first = recordProxy([], a);
  const second = recordProxy(first.events, b);
  assert.equal(second.events.length, 2);
  assert.equal(second.verification.valid, true);
});
