import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GeminiRestAgentOutputSource,
  type FetchLike,
  type FetchResponseLike,
} from "./index.ts";

function jsonResponse(payload: unknown, status = 200): FetchResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "ERROR",
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

test("GeminiRestAgentOutputSource calls the real Gemini REST surface and parses AgentOutput", async () => {
  const calls: Array<{ input: string; init: RequestInit }> = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push({ input, init });
    return jsonResponse({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  id: "ao_live_p1",
                  dealId: "deal_live",
                  dealName: "Live deal",
                  passNumber: 1,
                  reportedStatus: "on-track",
                  summary: "Live deal appears on track while SOC 2 evidence is missing.",
                  droppedRequirements: ["SOC 2 evidence"],
                  agentMetadata: {
                    agent: "Gemini",
                    model: "gemini-2.0-flash",
                    artifacts: ["brief"],
                  },
                }),
              },
            ],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: {
        promptTokenCount: 12,
        candidatesTokenCount: 18,
      },
    });
  };

  const source = new GeminiRestAgentOutputSource({
    apiKey: "test-key",
    fetchImpl,
    now: () => "2026-06-27T10:00:00.000Z",
  });

  const output = await source.getOutput("deal_live", 1);

  assert.equal(output.id, "ao_live_p1");
  assert.equal(output.dealId, "deal_live");
  assert.deepEqual(output.droppedRequirements, ["SOC 2 evidence"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.input, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.0-flash:generateContent/);
  assert.match(calls[0]!.input, /key=test-key/);
  assert.equal(calls[0]!.init.method, "POST");
  assert.equal(typeof calls[0]!.init.body, "string");

  const requestBody = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>;
  assert.deepEqual(requestBody.generationConfig, {
    temperature: 0,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
  });

  const history = source.history();
  assert.equal(history.requests.length, 1);
  assert.equal(history.requests[0]?.provider, "gemini");
  assert.equal(history.outcomes.length, 1);
  assert.equal(history.outcomes[0]?.status, "success");
  assert.deepEqual(history.outcomes[0]?.usage, {
    inputTokens: 12,
    outputTokens: 18,
    totalTokens: 30,
  });
});

test("GeminiRestAgentOutputSource records failed HTTP outcomes", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ error: "rate limited" }, 429);
  const source = new GeminiRestAgentOutputSource({
    apiKey: "test-key",
    fetchImpl,
    now: () => "2026-06-27T10:00:00.000Z",
  });

  await assert.rejects(
    () => source.getOutput("deal_live", 1),
    /Gemini request failed: HTTP 429/,
  );

  const history = source.history();
  assert.equal(history.requests.length, 1);
  assert.equal(history.outcomes.length, 1);
  assert.equal(history.outcomes[0]?.status, "error");
  assert.match(history.outcomes[0]?.error ?? "", /rate limited/);
});

test("GeminiRestAgentOutputSource rejects malformed model JSON through the AgentOutput contract", async () => {
  const fetchImpl: FetchLike = async () =>
    jsonResponse({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ id: "missing_required_fields" }) }],
          },
        },
      ],
    });
  const source = new GeminiRestAgentOutputSource({
    apiKey: "test-key",
    fetchImpl,
    now: () => "2026-06-27T10:00:00.000Z",
  });

  await assert.rejects(() => source.getOutput("deal_live", 1), /dealId/);
  assert.equal(source.history().outcomes[0]?.status, "error");
});
