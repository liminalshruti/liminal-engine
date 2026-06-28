/**
 * proposal / sow loader — markdown or plain-text documents.
 *
 * Chunking is STRUCTURAL and deterministic:
 *   - if the doc has markdown headings, each heading opens a section; the section
 *     BODY becomes a chunk with a hierarchical `section` span ("1", "1.1", "2"…),
 *     mirroring the contract's section locator (e.g. "7.2").
 *   - otherwise the doc is chunked by blank-line-separated paragraphs with `line`
 *     spans (1-based start/end line numbers into the normalized text).
 * A non-empty doc therefore always yields >= 1 chunk; a whitespace-only file is a
 * `ParseError` (empty source surfaced explicitly).
 *
 * The same loader serves `proposal` and `sow` — the source TYPE is decided by
 * routing (folder/extension/manifest), so this loader is parameterized by it.
 */
import { ParseError } from "../errors.ts";
import { normalizeText, toLines } from "../normalize.ts";
import type {
  EvidenceSourceType,
  ExtractedChunk,
  LoaderInput,
  LoaderResult,
  SourceLoader,
} from "../types.ts";

const HEADING = /^(#{1,6})\s+(.*\S)\s*$/;

/** Maintain hierarchical section numbers as headings are encountered. */
function nextSectionNumber(counters: number[], level: number): string {
  // grow/shrink the counter stack to this heading depth
  counters.length = level;
  for (let i = 0; i < level; i++) counters[i] = counters[i] ?? 0;
  counters[level - 1] = (counters[level - 1] ?? 0) + 1;
  return counters.join(".");
}

function chunkByHeadings(lines: string[]): ExtractedChunk[] {
  const chunks: ExtractedChunk[] = [];
  const counters: number[] = [];
  let current: { section: string; body: string[] } | undefined;

  const flush = (): void => {
    if (!current) return;
    const text = current.body.join("\n").trim();
    if (text.length > 0) {
      chunks.push({
        span: { unit: "section", start: current.section, end: current.section },
        text,
        label: "doc-section",
      });
    }
    current = undefined;
  };

  for (const line of lines) {
    const m = line.match(HEADING);
    if (m) {
      flush();
      const section = nextSectionNumber(counters, m[1]!.length);
      current = { section, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  flush();
  return chunks;
}

function chunkByParagraphs(lines: string[]): ExtractedChunk[] {
  const chunks: ExtractedChunk[] = [];
  let start = -1;
  let buf: string[] = [];
  const flush = (endLine: number): void => {
    const text = buf.join("\n").trim();
    if (text.length > 0 && start >= 0) {
      chunks.push({
        span: { unit: "line", start: String(start + 1), end: String(endLine + 1) },
        text,
        label: "doc-paragraph",
      });
    }
    buf = [];
    start = -1;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().length === 0) {
      flush(i - 1);
    } else {
      if (start < 0) start = i;
      buf.push(line);
    }
  }
  flush(lines.length - 1);
  return chunks;
}

export function createDocumentLoader(sourceType: EvidenceSourceType): SourceLoader {
  return {
    sourceType,
    load(input: LoaderInput): LoaderResult {
      const normalizedText = normalizeText(input.raw);
      if (normalizedText.trim().length === 0) {
        throw new ParseError(input.relPath, "document is empty / whitespace-only");
      }
      const lines = toLines(normalizedText);
      const hasHeadings = lines.some((l) => HEADING.test(l));
      const chunks = hasHeadings ? chunkByHeadings(lines) : chunkByParagraphs(lines);
      if (chunks.length === 0) {
        // structured-but-no-body (e.g. only headings, no content) — fall back to one
        // whole-document line span so the source is still citable, never dropped.
        return {
          normalizedText,
          chunks: [
            {
              span: { unit: "line", start: "1", end: String(lines.length) },
              text: normalizedText.trim(),
              label: "doc-body",
            },
          ],
        };
      }
      return { normalizedText, chunks };
    },
  };
}

export const proposalLoader = createDocumentLoader("proposal");
export const sowLoader = createDocumentLoader("sow");
