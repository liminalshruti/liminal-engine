/**
 * Optional `manifest.json` reader.
 *
 * A manifest makes an ingest folder SELF-DESCRIBING so `requirements ingest <dir>`
 * works with no flags: it declares the bundle's scope (`goalId`/`dealId`), an
 * optional explicit bundle `id`, an optional deterministic `capturedAt`, and
 * optional per-file overrides (`type`/`title`). Everything is optional EXCEPT that
 * the resulting bundle must end up scoped (enforced later, in `ingest.ts`).
 *
 * The manifest only carries NON-sensitive coordination metadata (ids, titles, type
 * hints, a timestamp) — never raw source text.
 */
import { ManifestError } from "./errors.ts";

/** Per-file override keyed by the file's path relative to the ingest root. */
export interface ManifestSourceOverride {
  readonly type?: string;
  readonly title?: string;
}

export interface Manifest {
  readonly id?: string;
  readonly goalId?: string;
  readonly dealId?: string;
  /** deterministic capture timestamp applied to every source (ISO-8601). */
  readonly capturedAt?: string;
  /** per-file overrides keyed by relative path. */
  readonly sources?: Readonly<Record<string, ManifestSourceOverride>>;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const optString = (v: unknown, field: string, path: string): string | undefined => {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || v.length === 0) {
    throw new ManifestError(path, `"${field}" must be a non-empty string`);
  }
  return v;
};

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Parse + validate a manifest's raw JSON string. Throws `ManifestError` on any problem. */
export function parseManifest(raw: string, path: string): Manifest {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new ManifestError(path, `not valid JSON: ${(err as Error).message}`);
  }
  if (!isObject(data)) throw new ManifestError(path, "must be a JSON object");

  const id = optString(data.id, "id", path);
  const goalId = optString(data.goalId, "goalId", path);
  const dealId = optString(data.dealId, "dealId", path);
  const capturedAt = optString(data.capturedAt, "capturedAt", path);
  if (capturedAt !== undefined && !ISO_DATETIME.test(capturedAt)) {
    throw new ManifestError(path, `"capturedAt" must be an ISO-8601 datetime, got "${capturedAt}"`);
  }

  let sources: Record<string, ManifestSourceOverride> | undefined;
  if (data.sources !== undefined) {
    if (!isObject(data.sources)) throw new ManifestError(path, `"sources" must be an object`);
    sources = {};
    for (const [key, value] of Object.entries(data.sources)) {
      if (!isObject(value)) {
        throw new ManifestError(path, `"sources['${key}']" must be an object`);
      }
      const type = optString(value.type, `sources['${key}'].type`, path);
      const title = optString(value.title, `sources['${key}'].title`, path);
      sources[key] = {
        ...(type !== undefined ? { type } : {}),
        ...(title !== undefined ? { title } : {}),
      };
    }
  }

  return {
    ...(id !== undefined ? { id } : {}),
    ...(goalId !== undefined ? { goalId } : {}),
    ...(dealId !== undefined ? { dealId } : {}),
    ...(capturedAt !== undefined ? { capturedAt } : {}),
    ...(sources !== undefined ? { sources } : {}),
  };
}
