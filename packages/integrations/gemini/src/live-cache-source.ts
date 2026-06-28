/**
 * GeminiAgentOutputSource — the LIVE-capable, cache-backed agent under observation.
 *
 * This is the real-product path (DIRECTIVE.md: no demo flows — operate on ARBITRARY
 * input, with real inference). It produces an `AgentOutput` from an arbitrary customer
 * transcript / proposal by calling Gemini — and REPLAYS a real captured response from a
 * content-addressed cache so the same input is deterministic and offline-filmable.
 *
 * Honesty contract (why this is not a "fixture pretending to be live"):
 *   - A cache entry is ONLY ever written by a real `generateContent` call (see
 *     `captureLive`). The adapter NEVER fabricates an AgentOutput.
 *   - On a cache MISS with no API key, it FAILS LOUDLY (`needs-live-run`) rather than
 *     inventing an answer — so a missing capture can never masquerade as real output.
 *   - The cache key is `sha256(model + "\n" + transcript)`, so replay is bound to the
 *     exact input + model that produced it.
 *
 * Resolution order for `getOutput`:
 *   1. cache HIT  → return the captured real response (offline, deterministic, film-able).
 *   2. cache MISS + GEMINI_API_KEY set → live `generateContent`, validate, WRITE cache, return.
 *   3. cache MISS + no key → throw `GeminiCacheMiss` (never fabricate).
 *
 * Pass semantics mirror the loop: pass 1 = first-pass output (may carry dropped
 * requirements — the false green); pass 2 = the corrected re-run (requirement honored).
 * The arbitrary input is supplied per deal via `register()` before the loop runs.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { agentOutputContract, type AgentOutput } from "@liminal-engine/contracts";
import type { AgentOutputSource } from "@liminal-engine/governance";

/** The arbitrary, real input the agent is asked to reason over for one deal. */
export interface AgentInput {
  readonly dealId: string;
  readonly dealName: string;
  /** the raw customer transcript / proposal / launch-plan text — ARBITRARY user data. */
  readonly transcript: string;
  /** named artifacts the agent had access to (provenance for the output). */
  readonly artifacts: readonly string[];
}

/** Thrown on a cache miss when no live call is possible — NEVER silently faked. */
export class GeminiCacheMiss extends Error {
  readonly cacheKey: string;
  readonly passNumber: number;
  constructor(cacheKey: string, passNumber: number) {
    super(
      `no cached Gemini response for pass ${passNumber} (key ${cacheKey.slice(0, 12)}…) ` +
        `and GEMINI_API_KEY is not set. Run \`pnpm gemini:capture\` with a key to populate the ` +
        `cache from a REAL call — this adapter never fabricates output.`,
    );
    this.name = "GeminiCacheMiss";
    this.cacheKey = cacheKey;
    this.passNumber = passNumber;
  }
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

/** Where captured real responses live — committed so the demo replays offline. */
function cacheDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "cache");
}

/** Content-addressed cache key: bound to the exact model + input that produced the output. */
export function cacheKeyFor(model: string, transcript: string, passNumber: number): string {
  return createHash("sha256").update(`${model}\n${passNumber}\n${transcript}`).digest("hex");
}

async function readCache(key: string): Promise<AgentOutput | undefined> {
  try {
    const raw = await readFile(join(cacheDir(), `${key}.json`), "utf8");
    // Validate on the way out: a cache file must be a contract-valid AgentOutput,
    // or it is treated as absent (a corrupt cache never yields a bogus "real" answer).
    const parsed = agentOutputContract.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function writeCache(key: string, output: AgentOutput): Promise<void> {
  await mkdir(cacheDir(), { recursive: true });
  await writeFile(join(cacheDir(), `${key}.json`), `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

/**
 * The live call. Isolated so the cache-replay path has ZERO dependency on the SDK or a
 * key — the demo runs offline. Only `captureLive` (the capture script) reaches the network.
 * Returns a contract-valid AgentOutput or throws (never a partial/fabricated object).
 */
export async function captureLive(input: AgentInput, passNumber: number): Promise<AgentOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set — cannot make a live Gemini call.");

  // Lazy import so the SDK is only required for capture, never for replay.
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });

  const instruction =
    passNumber <= 1
      ? `You are a GTM/Product/Launch agent team assessing a deal from the source material below. ` +
        `Report deal status as you actually find it. If a customer-stated gating requirement is not ` +
        `propagated into the proposal/launch plan/owner assignment, you may still report on-track ` +
        `(this captures the real first-pass miss). Return JSON with the exact AgentOutput shape.`
      : `Re-assess the SAME deal, now treating every customer-stated gating requirement as a ` +
        `revenue-critical blocker that must have an owner and launch path before "on-track". ` +
        `Return JSON with the exact AgentOutput shape, droppedRequirements empty if honored.`;

  const prompt =
    `${instruction}\n\n` +
    `Required JSON shape: { "id": string, "dealId": string, "dealName": string, ` +
    `"passNumber": number, "reportedStatus": "on-track"|"at-risk", "summary": string, ` +
    `"droppedRequirements": string[], "agentMetadata": { "agent": string, "model": string, ` +
    `"artifacts": string[] } }\n\n` +
    `dealId=${input.dealId}\ndealName=${input.dealName}\npassNumber=${passNumber}\n` +
    `artifacts=${JSON.stringify(input.artifacts)}\n\n--- SOURCE MATERIAL ---\n${input.transcript}`;

  const res = await model.generateContent(prompt);
  const json = JSON.parse(res.response.text());

  // Force provenance to the truth of THIS call — the model can't misreport what produced it.
  const candidate = {
    ...json,
    passNumber,
    agentMetadata: { agent: "Gemini", model: MODEL, artifacts: [...input.artifacts] },
  };
  // Contract-parse at the boundary: a malformed live response throws, never enters the cache.
  return agentOutputContract.parse(candidate);
}

export class GeminiAgentOutputSource implements AgentOutputSource {
  private readonly inputs = new Map<string, AgentInput>();

  /** Bind an arbitrary real input to a deal before the loop runs. */
  register(input: AgentInput): void {
    this.inputs.set(input.dealId, input);
  }

  async getOutput(dealId: string, passNumber: number): Promise<AgentOutput> {
    const input = this.inputs.get(dealId);
    if (!input) {
      throw new Error(`no input registered for deal ${dealId} — call register() first.`);
    }
    const key = cacheKeyFor(MODEL, input.transcript, passNumber);

    const cached = await readCache(key);
    if (cached) return cached; // 1. real captured response — offline, deterministic.

    if (process.env.GEMINI_API_KEY) {
      const live = await captureLive(input, passNumber); // 2. real call…
      await writeCache(key, live); //                        …then persist for replay.
      return live;
    }

    throw new GeminiCacheMiss(key, passNumber); // 3. never fabricate.
  }
}
