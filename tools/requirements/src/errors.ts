/**
 * Explicit, typed ingest errors.
 *
 * Acceptance criterion (LIM-1333): "Parser errors are explicit and never silently
 * drop files." Every way a file can fail to become evidence is a NAMED error that
 * carries the offending path + a human reason. The orchestrator collects these and
 * the CLI reports every one — a file is never quietly omitted from the bundle.
 *
 * Default posture is FAIL-CLOSED (repo `specs/IDEAS.md`: "fail-closed +
 * deterministic-first"): if any candidate source file fails, `ingest` aborts and
 * prints the full failure list rather than emitting a partial bundle. `--skip-errors`
 * relaxes this to "emit from the good files, but still report every failure" — the
 * failures are surfaced either way, never swallowed.
 */

/** Stable machine-readable codes for each failure mode (asserted in tests + CLI output). */
export type IngestErrorCode =
  | "not_a_directory"
  | "manifest_invalid"
  | "missing_scope"
  | "unclassified_file"
  | "parse_error"
  | "empty_source"
  | "no_sources"
  | "bundle_invalid";

/** Base class for every explicit ingest failure. Carries a stable `code`. */
export class IngestError extends Error {
  readonly code: IngestErrorCode;
  /** the source path this failure concerns, when file-scoped. */
  readonly path?: string;

  constructor(code: IngestErrorCode, message: string, path?: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (path !== undefined) this.path = path;
  }
}

/** The ingest target is missing or is not a directory. */
export class NotADirectoryError extends IngestError {
  constructor(path: string) {
    super("not_a_directory", `not a directory: ${path}`, path);
  }
}

/** A `manifest.json` was present but malformed / failed validation. */
export class ManifestError extends IngestError {
  constructor(path: string, detail: string) {
    super("manifest_invalid", `invalid manifest (${path}): ${detail}`, path);
  }
}

/** No `goalId`/`dealId` scope was provided — a bundle MUST be scoped (contract rule). */
export class MissingScopeError extends IngestError {
  constructor() {
    super(
      "missing_scope",
      "a bundle must be scoped: provide --goal <id> and/or --deal <id>, or a manifest.json with goalId/dealId",
    );
  }
}

/** A file could not be routed to one of the seven source types. */
export class UnclassifiedFileError extends IngestError {
  constructor(path: string, detail: string) {
    super("unclassified_file", `cannot classify source (${path}): ${detail}`, path);
  }
}

/** A loader recognized the file's type but failed to parse its contents. */
export class ParseError extends IngestError {
  constructor(path: string, detail: string) {
    super("parse_error", `parse error (${path}): ${detail}`, path);
  }
}

/** A file was classified + parsed but yielded no citable text. */
export class EmptySourceError extends IngestError {
  constructor(path: string) {
    super("empty_source", `empty source — no citable text (${path})`, path);
  }
}

/** The folder produced zero successful sources, so no bundle can be built. */
export class NoSourcesError extends IngestError {
  constructor(detail: string) {
    super("no_sources", `no ingestible sources: ${detail}`);
  }
}

/** The assembled bundle failed EvidenceBundle contract validation. */
export class BundleInvalidError extends IngestError {
  constructor(detail: string) {
    super("bundle_invalid", `assembled bundle failed EvidenceBundle validation: ${detail}`);
  }
}

/** Thrown by the orchestrator when (fail-closed) one or more files failed to ingest. */
export class IngestFailedError extends IngestError {
  /** every file-scoped failure, in deterministic path order — none omitted. */
  readonly failures: readonly IngestError[];

  constructor(failures: readonly IngestError[]) {
    const list = failures.map((f) => `  - ${f.message}`).join("\n");
    super(
      "parse_error",
      `${failures.length} file(s) failed to ingest (no file was silently dropped):\n${list}`,
    );
    this.failures = failures;
  }
}
