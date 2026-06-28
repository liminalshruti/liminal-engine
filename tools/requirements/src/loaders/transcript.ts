/**
 * customer_call loader — call / meeting transcripts.
 *
 * Supports two real, common shapes:
 *   - WebVTT (`.vtt`): cue blocks `HH:MM:SS.mmm --> HH:MM:SS.mmm` + text.
 *   - bracketed timecode lines: `[HH:MM:SS] Speaker: text` (one cue per line).
 * Each cue becomes a chunk with a `timecode` span (start/end normalized to
 * `HH:MM:SS`) committed to by `sha256(cue text)`. A file that declares itself a
 * transcript but contains NO parseable cue is a `ParseError`, never an empty pass.
 */
import { ParseError } from "../errors.ts";
import { normalizeText } from "../normalize.ts";
import type { ExtractedChunk, LoaderInput, LoaderResult, SourceLoader } from "../types.ts";

/** `H:MM:SS.mmm` / `MM:SS.mmm` / `HH:MM:SS` → `HH:MM:SS` (drop millis, pad hours). */
function normalizeTimecode(tc: string): string {
  const [clock] = tc.trim().split(".");
  const parts = (clock ?? "").split(":").map((p) => p.padStart(2, "0"));
  while (parts.length < 3) parts.unshift("00");
  return parts.slice(-3).join(":");
}

const VTT_CUE_TIMING = /^(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?)/;
const BRACKET_LINE = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/;

function parseVtt(normalized: string): ExtractedChunk[] {
  const blocks = normalized.split(/\n\s*\n/);
  const chunks: ExtractedChunk[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    if (lines.length === 0) continue;
    // An optional cue identifier line may precede the timing line.
    let idx = 0;
    if (lines[idx] !== undefined && !VTT_CUE_TIMING.test(lines[idx]!) && lines[idx + 1] !== undefined && VTT_CUE_TIMING.test(lines[idx + 1]!)) {
      idx = 1;
    }
    const timing = lines[idx]?.match(VTT_CUE_TIMING);
    if (!timing) continue;
    const text = lines.slice(idx + 1).join("\n").trim();
    if (text.length === 0) continue;
    chunks.push({
      span: { unit: "timecode", start: normalizeTimecode(timing[1]!), end: normalizeTimecode(timing[2]!) },
      text,
      label: "transcript-cue",
    });
  }
  return chunks;
}

function parseBracketed(normalized: string): ExtractedChunk[] {
  const lines = normalized.split("\n");
  const chunks: ExtractedChunk[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(BRACKET_LINE);
    if (!m) continue;
    const text = (m[2] ?? "").trim();
    if (text.length === 0) continue;
    const start = normalizeTimecode(m[1]!);
    // end = the next cue's start when known, else the same point.
    let end = start;
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j]!.match(BRACKET_LINE);
      if (next) {
        end = normalizeTimecode(next[1]!);
        break;
      }
    }
    chunks.push({ span: { unit: "timecode", start, end }, text, label: "transcript-cue" });
  }
  return chunks;
}

export const transcriptLoader: SourceLoader = {
  sourceType: "customer_call",
  load(input: LoaderInput): LoaderResult {
    const normalizedText = normalizeText(input.raw);
    // WebVTT begins with a "WEBVTT" signature line; strip it before cue parsing.
    const isVtt = /^WEBVTT\b/.test(normalizedText);
    const body = isVtt ? normalizedText.replace(/^WEBVTT[^\n]*\n?/, "") : normalizedText;

    // Try cue-block (VTT) parsing first, then bracketed-line parsing.
    let chunks = parseVtt(body);
    if (chunks.length === 0) chunks = parseBracketed(normalizedText);
    if (chunks.length === 0) {
      throw new ParseError(
        input.relPath,
        "no timed cues found — expected WebVTT (`HH:MM:SS --> HH:MM:SS`) or bracketed `[HH:MM:SS]` lines",
      );
    }
    return { normalizedText, chunks };
  },
};
