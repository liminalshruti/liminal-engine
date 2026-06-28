/**
 * Bundle assembly — turn loaded sources into a validated `EvidenceBundle`.
 *
 * This is where the acceptance criteria are made concrete:
 *   - "Every chunk has stable source refs (sourceId/sourceType/span/hash)": each
 *     source gets a deterministic `sourceId` (ids.ts) + `hash = sha256(normalized
 *     text)`; each chunk gets `sourceId` + `span` + `hash = sha256(span text)`.
 *   - data boundary: only hashes + non-sensitive metadata (title / label / span)
 *     are placed on the bundle — the raw `normalizedText`/chunk `text` are consumed
 *     to compute hashes and then dropped, never persisted.
 *
 * The assembled object is run through `evidenceBundleContract.parse`, so referential
 * integrity (every chunk cites a known source), id uniqueness, scope, hash format,
 * and agent-output linkage are all enforced by the OWNING contract (LIM-1323) — this
 * loader cannot emit a bundle the contract would reject.
 */
import {
  evidenceBundleContract,
  sha256Hex,
  type EvidenceAgentOutputRef,
  type EvidenceBundle,
  type EvidenceChunk,
  type EvidenceSource,
} from "./contracts.ts";
import { BundleInvalidError } from "./errors.ts";
import { deriveChunkId, deriveSourceId } from "./ids.ts";
import type { LoadedSource } from "./types.ts";

export interface AssembleOptions {
  readonly id: string;
  readonly goalId?: string;
  readonly dealId?: string;
  /** deterministic ISO-8601 capture timestamp stamped on every source. */
  readonly capturedAt: string;
}

/** A non-durable per-source projection (durable bundle + the in-memory hashes it proves). */
export interface AssembleResult {
  readonly bundle: EvidenceBundle;
  /** count of chunks emitted, for the CLI summary. */
  readonly chunkCount: number;
}

const baseName = (relPath: string): string => relPath.split("/").pop() ?? relPath;

export function assembleBundle(loaded: readonly LoadedSource[], opts: AssembleOptions): AssembleResult {
  const sources: EvidenceSource[] = [];
  const chunks: EvidenceChunk[] = [];
  const agentOutputs: EvidenceAgentOutputRef[] = [];

  for (const src of loaded) {
    const sourceId = deriveSourceId(src.sourceType, src.relPath, baseName(src.relPath));
    sources.push({
      sourceId,
      sourceType: src.sourceType,
      title: src.title,
      hash: sha256Hex(src.normalizedText),
      capturedAt: opts.capturedAt,
    });

    src.chunks.forEach((chunk, i) => {
      chunks.push({
        chunkId: deriveChunkId(sourceId, i + 1),
        sourceId,
        span: { unit: chunk.span.unit, start: chunk.span.start, end: chunk.span.end },
        hash: sha256Hex(chunk.text),
        ...(chunk.label !== undefined ? { label: chunk.label } : {}),
      });
    });

    if (src.agentOutputId !== undefined) {
      agentOutputs.push({ agentOutputId: src.agentOutputId, sourceId });
    }
  }

  const candidate: EvidenceBundle = {
    id: opts.id,
    ...(opts.goalId !== undefined ? { goalId: opts.goalId } : {}),
    ...(opts.dealId !== undefined ? { dealId: opts.dealId } : {}),
    sources,
    chunks,
    ...(agentOutputs.length > 0 ? { agentOutputs } : {}),
  };

  // The OWNING contract validates referential integrity, uniqueness, scope, hash
  // shape, agent-output linkage. Surface a failure as an explicit error, never throw raw.
  const parsed = evidenceBundleContract.safeParse(candidate);
  if (!parsed.success) {
    throw new BundleInvalidError(parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; "));
  }
  return { bundle: parsed.data, chunkCount: chunks.length };
}
