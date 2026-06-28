/**
 * Stable, reproducible identifier derivation.
 *
 * Acceptance criterion (LIM-1333): "Every chunk has stable source refs
 * (sourceId/sourceType/span/hash)." Ids are derived PURELY from inputs that don't
 * change between runs — the source's relative path and the chunk's position — so
 * re-ingesting the same folder yields byte-identical ids (and therefore an identical
 * bundle hash). No clock, no RNG, no array-index-of-discovery.
 *
 * A short `sha256(relPath)` suffix on the source id guarantees global uniqueness
 * (two different paths cannot collide) while a human-readable slug keeps the id
 * legible. The relative path is non-sensitive metadata (a file name), so it is safe
 * to use as an id seed.
 */
import { sha256Hex } from "./contracts.ts";

/** Lowercase, underscore-joined, ascii-only slug. Always non-empty. */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug.length > 0 ? slug : "x";
}

/** Strip a trailing extension (and known double extensions like `.slack.json`). */
export function stripKnownExt(fileName: string): string {
  return fileName
    .replace(/\.(slack|linear|agent)\.json$/i, "")
    .replace(/\.[^.]+$/, "");
}

/**
 * Derive a stable + unique source id: `src_<type>_<name-slug>_<8-hex-of-path>`.
 * Deterministic for a given (sourceType, relPath); the path hash makes it collision
 * free even when two files in different folders share a base name.
 */
export function deriveSourceId(sourceType: string, relPath: string, baseName: string): string {
  const suffix = sha256Hex(relPath).slice(0, 8);
  return `src_${slugify(sourceType)}_${slugify(stripKnownExt(baseName))}_${suffix}`;
}

/** Derive a stable chunk id under its source: `<sourceId>__c<3-digit-ordinal>`. */
export function deriveChunkId(sourceId: string, ordinal: number): string {
  return `${sourceId}__c${String(ordinal).padStart(3, "0")}`;
}

/** Derive a default bundle id from the ingest folder name: `eb_<folder-slug>`. */
export function deriveBundleId(folderName: string): string {
  return `eb_${slugify(folderName)}`;
}
