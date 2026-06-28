/**
 * Ingest orchestrator — walk a local folder and normalize it into ONE validated
 * `EvidenceBundle`. This is the engine behind `requirements ingest <dir>`.
 *
 * Guarantees that back the acceptance criteria:
 *   - DETERMINISTIC: files are processed in sorted relative-path order; ids/hashes
 *     are content/path-derived; `capturedAt` is taken from the manifest/flag when
 *     determinism matters. Re-running on the same folder yields an identical bundle.
 *   - NEVER SILENTLY DROPS: every file is either ingested, reported as an explicit
 *     per-file failure, or listed as a recognized non-source (`ignored`). The
 *     default posture is FAIL-CLOSED — any failure aborts with the full list;
 *     `skipErrors` keeps the good sources but still reports every failure.
 *
 * Node core (`fs`/`path`) is used freely here: this is a TOOL, outside the package
 * graph the boundary lint guards — it is not the pure domain.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, posix, relative, sep } from "node:path";
import { assembleBundle } from "./bundle.ts";
import {
  IngestError,
  IngestFailedError,
  MissingScopeError,
  NoSourcesError,
  NotADirectoryError,
} from "./errors.ts";
import { deriveBundleId } from "./ids.ts";
import { getLoader } from "./loaders/index.ts";
import { parseManifest, type Manifest } from "./manifest.ts";
import { routeSourceType } from "./routing.ts";
import type { EvidenceBundle } from "./contracts.ts";
import type { LoadedSource } from "./types.ts";

export const MANIFEST_FILE = "manifest.json";

/** Recognized non-source files that are explicitly ignored (and reported), not dropped. */
function isIgnored(fileName: string): boolean {
  if (fileName === MANIFEST_FILE) return true;
  if (fileName.startsWith(".")) return true; // dotfiles incl. .DS_Store
  if (/^readme(\.|$)/i.test(fileName)) return true;
  if (/^license(\.|$)/i.test(fileName)) return true;
  return false;
}

export interface IngestOptions {
  readonly goalId?: string;
  readonly dealId?: string;
  readonly id?: string;
  readonly capturedAt?: string;
  /** keep good sources and report (don't abort) when some files fail. */
  readonly skipErrors?: boolean;
}

export interface IngestSourceSummary {
  readonly relPath: string;
  readonly sourceType: string;
  readonly chunkCount: number;
}

export interface IngestReport {
  readonly rootDir: string;
  readonly bundleId: string;
  readonly goalId?: string;
  readonly dealId?: string;
  readonly capturedAt: string;
  readonly sourceCount: number;
  readonly chunkCount: number;
  readonly sources: readonly IngestSourceSummary[];
  readonly ignored: readonly string[];
  readonly failures: readonly IngestError[];
}

export interface IngestResult {
  readonly bundle: EvidenceBundle;
  readonly report: IngestReport;
}

/** Turn a file/base name into a NON-sensitive display title ("acme-kickoff" → "Acme Kickoff"). */
function filenameToTitle(fileName: string): string {
  const stem = fileName.replace(/\.(slack|linear|agent)\.json$/i, "").replace(/\.[^.]+$/, "");
  const words = stem.split(/[\s._-]+/).filter((w) => w.length > 0);
  const titled = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return titled.length > 0 ? titled : fileName;
}

/** Recursively collect files under `root`, returned as POSIX relative paths, sorted. */
function walkFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue; // skip dot-dirs (e.g. .git)
        walk(abs);
      } else if (entry.isFile()) {
        out.push(relative(root, abs).split(sep).join(posix.sep));
      }
    }
  };
  walk(root);
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function readManifest(root: string): Manifest {
  const path = join(root, MANIFEST_FILE);
  try {
    statSync(path);
  } catch {
    return {}; // no manifest — fine, scope must then come from flags
  }
  return parseManifest(readFileSync(path, "utf8"), `${MANIFEST_FILE}`);
}

/** Ingest a local folder into a validated EvidenceBundle. Throws an `IngestError` on failure. */
export function ingestFolder(rootDir: string, opts: IngestOptions = {}): IngestResult {
  let stat;
  try {
    stat = statSync(rootDir);
  } catch {
    throw new NotADirectoryError(rootDir);
  }
  if (!stat.isDirectory()) throw new NotADirectoryError(rootDir);

  const manifest = readManifest(rootDir);

  const goalId = opts.goalId ?? manifest.goalId;
  const dealId = opts.dealId ?? manifest.dealId;
  if (goalId === undefined && dealId === undefined) throw new MissingScopeError();

  const capturedAt = opts.capturedAt ?? manifest.capturedAt ?? new Date().toISOString();
  const bundleId = opts.id ?? manifest.id ?? deriveBundleId(basename(rootDir.replace(/[/\\]+$/, "")));

  const relPaths = walkFiles(rootDir);
  const loaded: LoadedSource[] = [];
  const ignored: string[] = [];
  const failures: IngestError[] = [];

  for (const relPath of relPaths) {
    const fileName = relPath.split(posix.sep).pop()!;
    if (isIgnored(fileName)) {
      ignored.push(relPath);
      continue;
    }
    const segments = relPath.split(posix.sep);
    const parentDir = segments.length >= 2 ? segments[segments.length - 2]! : "";
    const override = manifest.sources?.[relPath];

    try {
      const sourceType = routeSourceType({
        relPath,
        fileName,
        parentDir,
        ...(override?.type !== undefined ? { overrideType: override.type } : {}),
      });
      const title = override?.title ?? filenameToTitle(fileName);
      const raw = readFileSync(join(rootDir, ...segments), "utf8");
      const result = getLoader(sourceType).load({ relPath, fileName, title, raw });
      loaded.push({ ...result, sourceType, title, relPath });
    } catch (err) {
      if (err instanceof IngestError) failures.push(err);
      else throw err; // unexpected (non-ingest) errors propagate
    }
  }

  // FAIL-CLOSED: surface every failure; never quietly omit a file.
  if (failures.length > 0 && !opts.skipErrors) {
    throw new IngestFailedError(failures);
  }
  if (loaded.length === 0) {
    throw new NoSourcesError(
      `${relPaths.length} file(s) seen, ${ignored.length} ignored, ${failures.length} failed`,
    );
  }

  const { bundle, chunkCount } = assembleBundle(loaded, {
    id: bundleId,
    ...(goalId !== undefined ? { goalId } : {}),
    ...(dealId !== undefined ? { dealId } : {}),
    capturedAt,
  });

  const report: IngestReport = {
    rootDir,
    bundleId,
    ...(goalId !== undefined ? { goalId } : {}),
    ...(dealId !== undefined ? { dealId } : {}),
    capturedAt,
    sourceCount: loaded.length,
    chunkCount,
    sources: loaded.map((s) => ({ relPath: s.relPath, sourceType: s.sourceType, chunkCount: s.chunks.length })),
    ignored,
    failures,
  };

  return { bundle, report };
}
