/**
 * agent_output loader — a normalized agent report (`.agent.json`).
 *
 * An agent's report is FIRST-CLASS cited evidence (the EvidenceBundle contract
 * treats `agent_output` as a source type, and the bundle carries an `agentOutputs`
 * ref linking the `AgentOutput` id to its source). The file declares its
 * `agentOutputId` and a `report` (string) or `lines` (string[]). Each non-empty
 * report line becomes a chunk with a 1-based `line` span committed to by
 * `sha256(line)`.
 *
 * `agentOutputId` is REQUIRED: without it the bundle could not link the source back
 * to its `AgentOutput`, so a missing id is a `ParseError` (never a silent drop).
 */
import { ParseError } from "../errors.ts";
import { normalizeText, toLines } from "../normalize.ts";
import type { ExtractedChunk, LoaderInput, LoaderResult, SourceLoader } from "../types.ts";

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

export const agentOutputLoader: SourceLoader = {
  sourceType: "agent_output",
  load(input: LoaderInput): LoaderResult {
    let root: unknown;
    try {
      root = JSON.parse(input.raw);
    } catch (err) {
      throw new ParseError(input.relPath, `not valid JSON: ${(err as Error).message}`);
    }
    if (root === null || typeof root !== "object" || Array.isArray(root)) {
      throw new ParseError(input.relPath, "expected a JSON object { agentOutputId, report }");
    }
    const obj = root as Record<string, unknown>;

    const agentOutputId = str(obj.agentOutputId) ?? str(obj.id);
    if (agentOutputId === undefined) {
      throw new ParseError(input.relPath, `missing required "agentOutputId"`);
    }

    let report: string;
    if (Array.isArray(obj.lines)) {
      report = (obj.lines as unknown[]).map((l) => (typeof l === "string" ? l : "")).join("\n");
    } else if (str(obj.report) !== undefined) {
      report = obj.report as string;
    } else if (str(obj.summary) !== undefined) {
      report = obj.summary as string;
    } else {
      throw new ParseError(input.relPath, `missing "report" (string) or "lines" (string[])`);
    }

    const normalizedText = normalizeText(report);
    const lines = toLines(normalizedText);
    const chunks: ExtractedChunk[] = [];
    lines.forEach((line, i) => {
      const text = line.trim();
      if (text.length === 0) return;
      chunks.push({
        span: { unit: "line", start: String(i + 1), end: String(i + 1) },
        text,
        label: "agent-line",
      });
    });

    if (chunks.length === 0) {
      throw new ParseError(input.relPath, "agent report has no non-empty lines");
    }
    return { normalizedText, chunks, agentOutputId };
  },
};
