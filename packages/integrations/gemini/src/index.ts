/**
 * Gemini integration — agent-output sources behind the same `AgentOutputSource`
 * port.
 *
 * `FixtureAgentOutputSource` keeps deterministic composition roots offline.
 * `GeminiAgentOutputSource` is the upstream cache-backed live/captured source for
 * arbitrary registered input. `GeminiRestAgentOutputSource` is a direct REST
 * adapter that records LlmRequest/LlmOutcome receipts around generateContent.
 */
import {
  agentOutputContract,
  endpointConfigContract,
  llmOutcomeContract,
  llmRequestContract,
  type AgentOutput,
  type EndpointConfig,
  type JsonObject,
  type LlmOutcome,
  type LlmRequest,
  type LlmTokenUsage,
} from "@liminal-engine/contracts";
import { acmeAgentOutputPass1, acmeAgentOutputPass2 } from "@liminal-engine/contracts/fixtures";
import type { AgentOutputSource } from "@liminal-engine/governance";

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<FetchResponseLike>;

export interface GeminiRestAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  endpointConfigId?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  now?: () => string;
  buildPrompt?: (dealId: string, passNumber: number) => string;
}

export interface GeminiRestHistory {
  requests: readonly LlmRequest[];
  outcomes: readonly LlmOutcome[];
}

export class GeminiRestAgentOutputSource implements AgentOutputSource {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly endpointConfigId: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => string;
  private readonly buildPrompt: (dealId: string, passNumber: number) => string;
  private readonly requests: LlmRequest[] = [];
  private readonly outcomes: LlmOutcome[] = [];
  private nextSequence = 1;

  constructor(config: GeminiRestAdapterConfig) {
    if (config.apiKey.trim().length === 0) {
      throw new Error("GeminiRestAgentOutputSource requires a non-empty apiKey");
    }
    this.apiKey = config.apiKey;
    this.model = config.model ?? "gemini-2.0-flash";
    this.baseUrl = (config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/g, "");
    this.endpointConfigId = config.endpointConfigId ?? "endpoint_gemini_agent_output";
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? (() => new Date().toISOString());
    this.buildPrompt = config.buildPrompt ?? defaultAgentOutputPrompt;
  }

  endpointConfig(): EndpointConfig {
    return endpointConfigContract.parse({
      id: this.endpointConfigId,
      provider: "gemini",
      purpose: "Generate and parse governed agent output",
      endpointUrl: this.baseUrl,
      model: this.model,
      auth: { scheme: "api-key", secretRef: "env:GEMINI_API_KEY" },
      timeoutMs: this.timeoutMs,
      retry: { maxAttempts: 1, backoffMs: 0 },
      enabled: true,
      createdAt: this.now(),
      metadata: { responseFormat: "json" },
    });
  }

  history(): GeminiRestHistory {
    return {
      requests: [...this.requests],
      outcomes: [...this.outcomes],
    };
  }

  async getOutput(dealId: string, passNumber: number): Promise<AgentOutput> {
    const request = llmRequestContract.parse({
      id: this.nextId("llm_req"),
      endpointConfigId: this.endpointConfigId,
      provider: "gemini",
      model: this.model,
      messages: [{ role: "user", content: this.buildPrompt(dealId, passNumber) }],
      responseFormat: "json",
      responseSchema: { contract: agentOutputContract.schema },
      temperature: 0,
      maxOutputTokens: 1024,
      metadata: { dealId, passNumber },
      requestedAt: this.now(),
    });
    this.requests.push(request);

    const startedAt = Date.now();
    let outcomeRecorded = false;
    const recordOutcome = (input: Omit<LlmOutcome, "id" | "requestId" | "provider" | "model" | "latencyMs" | "completedAt">): LlmOutcome => {
      const outcome = llmOutcomeContract.parse({
        id: this.nextId("llm_out"),
        requestId: request.id,
        provider: "gemini",
        model: this.model,
        latencyMs: Date.now() - startedAt,
        completedAt: this.now(),
        ...input,
      });
      this.outcomes.push(outcome);
      outcomeRecorded = true;
      return outcome;
    };

    try {
      const response = await this.fetchGemini(request);
      if (!response.ok) {
        const body = await safeText(response);
        const message = `HTTP ${response.status}: ${response.statusText}${body ? ` - ${body}` : ""}`;
        recordOutcome({ status: "error", error: message });
        throw new Error(`Gemini request failed: ${message}`);
      }

      const payload = await response.json();
      const { text, finishReason, usage } = parseGeminiPayload(payload);
      const parsedJson = parseJsonObjectFromText(text);
      const output = agentOutputContract.parse(parsedJson);
      recordOutcome({
        status: "success",
        outputText: text,
        parsedJson: toJsonObject(output),
        ...(usage !== undefined ? { usage } : {}),
        ...(finishReason !== undefined ? { finishReason } : {}),
      });
      return output;
    } catch (error) {
      if (!outcomeRecorded) {
        recordOutcome({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  private async fetchGemini(request: LlmRequest): Promise<FetchResponseLike> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const body = {
      contents: request.messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        temperature: request.temperature ?? 0,
        maxOutputTokens: request.maxOutputTokens ?? 1024,
        responseMimeType: "application/json",
      },
    };

    try {
      return await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private nextId(prefix: string): string {
    const id = `${prefix}_${this.nextSequence}`;
    this.nextSequence += 1;
    return id;
  }
}

export class FixtureAgentOutputSource implements AgentOutputSource {
  async getOutput(_dealId: string, passNumber: number): Promise<AgentOutput> {
    return passNumber <= 1 ? acmeAgentOutputPass1 : acmeAgentOutputPass2;
  }
}

export {
  GeminiAgentOutputSource,
  GeminiCacheMiss,
  captureLive,
  cacheKeyFor,
  type AgentInput,
} from "./live-cache-source.ts";

export function createGeminiRestAgentOutputSourceFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Omit<GeminiRestAdapterConfig, "apiKey"> = {},
): GeminiRestAgentOutputSource {
  const apiKey = env.GEMINI_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error("GEMINI_API_KEY is required to create a live Gemini REST adapter");
  }
  return new GeminiRestAgentOutputSource({ ...overrides, apiKey });
}

function defaultAgentOutputPrompt(dealId: string, passNumber: number): string {
  return [
    "Return only JSON matching liminal_engine.agent_output.v1.",
    "Required fields: id, dealId, dealName, passNumber, reportedStatus, summary, droppedRequirements, agentMetadata.",
    `dealId: ${dealId}`,
    `passNumber: ${passNumber}`,
    "reportedStatus must be either on-track or at-risk.",
    "droppedRequirements must list any load-bearing requirements absent from the output.",
  ].join("\n");
}

function parseGeminiPayload(payload: unknown): {
  text: string;
  finishReason?: string;
  usage?: LlmTokenUsage;
} {
  const root = asRecord(payload, "Gemini response");
  const candidates = asArray(root.candidates, "Gemini candidates");
  const firstCandidate = asRecord(candidates[0], "Gemini first candidate");
  const content = asRecord(firstCandidate.content, "Gemini candidate content");
  const parts = asArray(content.parts, "Gemini content parts");
  const text = parts
    .map((part) => asRecord(part, "Gemini part").text)
    .filter((partText): partText is string => typeof partText === "string" && partText.length > 0)
    .join("\n")
    .trim();
  if (text.length === 0) {
    throw new Error("Gemini response did not include text content");
  }

  const finishReason = typeof firstCandidate.finishReason === "string"
    ? firstCandidate.finishReason
    : undefined;
  const usage = parseUsage(root.usageMetadata);
  return { text, ...(finishReason !== undefined ? { finishReason } : {}), ...(usage !== undefined ? { usage } : {}) };
}

function parseUsage(value: unknown): LlmTokenUsage | undefined {
  if (value === undefined) return undefined;
  const usage = asRecord(value, "Gemini usageMetadata");
  const inputTokens = numberValue(usage.promptTokenCount);
  const outputTokens = numberValue(usage.candidatesTokenCount);
  if (inputTokens === undefined || outputTokens === undefined) return undefined;
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function parseJsonObjectFromText(text: string): JsonObject {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Gemini response did not contain a JSON object");
  }
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  return toJsonObject(parsed);
}

function toJsonObject(value: unknown): JsonObject {
  if (!isRecord(value)) {
    throw new Error("Expected a JSON object");
  }
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function safeText(response: FetchResponseLike): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
