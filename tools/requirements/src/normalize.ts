/**
 * Deterministic text normalization.
 *
 * Conservative ON PURPOSE: it only strips a UTF-8 BOM and normalizes line endings
 * to `\n`. It does NOT trim or collapse interior content, because span locators
 * (char offsets, line numbers) are computed AGAINST the normalized text — rewriting
 * the body would desync those offsets. Idempotent: `normalizeText(normalizeText(x))
 * === normalizeText(x)`, so re-ingesting the same bytes yields the same hashes.
 */

/** Strip a leading BOM and normalize CRLF/CR to LF. Pure + idempotent. */
export function normalizeText(raw: string): string {
  return raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

/** Split normalized text into lines (no trailing-newline phantom line). */
export function toLines(normalized: string): string[] {
  const lines = normalized.split("\n");
  // Drop a single trailing empty line produced by a terminal newline so line
  // numbers match what an editor shows.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}
