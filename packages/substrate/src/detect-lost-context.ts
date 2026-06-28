/**
 * detect-lost-context — the REAL detection that converts demo → product.
 *
 * Instead of reading a pre-baked `droppedRequirements` off a fixture, this computes
 * lost context from arbitrary ingested streams: a requirement stated in the source
 * stream (e.g. the call) that never propagated into the downstream work streams
 * (proposal, plan, scope) is lost. [BUILD_PLAN.md Gap 2]
 */
import type { InMemorySubstrate, StreamSourceType } from "./substrate.ts";

export interface DetectLostContextInput {
  /** The requirements to track (e.g. extracted from the call). */
  readonly requirements: readonly string[];
  /** The source-type the requirements were stated in (excluded from "downstream"). */
  readonly statedIn: StreamSourceType;
}

/** A requirement appears in a stream if its text occurs in the stream content (case-insensitive). */
function mentions(content: string, requirement: string): boolean {
  return content.toLowerCase().includes(requirement.toLowerCase());
}

/**
 * Return the requirements that were stated in `statedIn` but appear in NONE of the
 * downstream streams — the lost context. Order follows `requirements`.
 */
export function detectLostContext(
  substrate: InMemorySubstrate,
  input: DetectLostContextInput,
): string[] {
  const downstream = substrate.streams().filter((s) => s.sourceType !== input.statedIn);
  return input.requirements.filter(
    (req) => !downstream.some((s) => mentions(s.content, req)),
  );
}
