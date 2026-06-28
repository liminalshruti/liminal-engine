/**
 * Internal loader types — the in-memory shape between "raw file on disk" and a
 * validated `EvidenceBundle`.
 *
 * Data-boundary discipline (LIM-1333 guardrail, EvidenceBundle contract lineage):
 * the raw `text`/`normalizedText` here exist ONLY in memory so a real sha256 can be
 * computed; they are NEVER written into the durable bundle. The bundle carries only
 * content-hash references + non-sensitive metadata (title / structural label / span
 * locator). See `bundle.ts`.
 */
import type { EvidenceSourceType, EvidenceSpanUnit } from "./contracts.ts";

export type { EvidenceSourceType, EvidenceSpanUnit };

/** A located, citable region extracted from one source, before bundle assembly. */
export interface ExtractedChunk {
  /** span locator into the source (unit + start/end), e.g. timecode / section / line. */
  readonly span: { readonly unit: EvidenceSpanUnit; readonly start: string; readonly end: string };
  /** the EXACT quoted span text — hashed into the chunk ref, never persisted raw. */
  readonly text: string;
  /** a NON-sensitive structural category, safe to display (e.g. "doc-section"). */
  readonly label?: string;
}

/** Everything a loader produces from one file, before ids/hashes are assigned. */
export interface LoaderResult {
  /** the full normalized source text — hashed into the source ref, never persisted raw. */
  readonly normalizedText: string;
  /** the citable chunks extracted from the source (>= 1 for a non-empty source). */
  readonly chunks: readonly ExtractedChunk[];
  /** for `agent_output` sources only — the `AgentOutput` id this captures (bundle ref). */
  readonly agentOutputId?: string;
}

/** Input handed to a loader for one classified file. */
export interface LoaderInput {
  /** path of the file relative to the ingest root (stable id seed; non-sensitive). */
  readonly relPath: string;
  /** base file name, e.g. "acme-kickoff.vtt". */
  readonly fileName: string;
  /** resolved non-sensitive display title (manifest override or filename-derived). */
  readonly title: string;
  /** raw UTF-8 file contents. */
  readonly raw: string;
}

/** A source loader for one `EvidenceSourceType`. */
export interface SourceLoader {
  readonly sourceType: EvidenceSourceType;
  /**
   * Parse + normalize one file into citable chunks. MUST throw `ParseError`
   * (errors.ts) on malformed input — never return empty to hide a parse failure.
   */
  load(input: LoaderInput): LoaderResult;
}

/** A source successfully loaded from one file (ready for id/hash assignment). */
export interface LoadedSource extends LoaderResult {
  readonly sourceType: EvidenceSourceType;
  readonly title: string;
  readonly relPath: string;
}
