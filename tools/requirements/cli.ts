#!/usr/bin/env node
/**
 * `requirements` — the live-source ingest CLI (LIM-1333).
 *
 * Normalizes a local folder of REAL source material (call transcripts, proposals,
 * SOWs, emails, Slack, Linear, agent outputs) into ONE cited, content-addressed
 * `EvidenceBundle` JSON — the provenance substrate the rest of the system points at.
 *
 * Canonical invocation (repo convention — tools run via `node tools/<file>.ts`,
 * cf. `tools/regen-goldens.ts`):
 *
 *     node tools/requirements/cli.ts ingest ./examples/acme-real/
 *     node tools/requirements/cli.ts fixture            # deterministic fallback bundle
 *
 * (The file is executable, so `./tools/requirements/cli.ts ingest …` works too.)
 *
 * stdout carries ONLY the bundle JSON (pipeable); the human-readable summary and all
 * errors go to stderr. Exit code is non-zero on any explicit ingest failure.
 */
import { writeFileSync } from "node:fs";
import { realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureBundle } from "./src/fixture.ts";
import { ingestFolder, type IngestReport } from "./src/ingest.ts";
import { IngestError, NoSourcesError } from "./src/errors.ts";
import type { EvidenceBundle } from "./src/contracts.ts";

export interface CliDeps {
  readonly stdout: Pick<NodeJS.WritableStream, "write">;
  readonly stderr: Pick<NodeJS.WritableStream, "write">;
  readonly cwd: string;
}

interface ParsedArgs {
  command: string;
  dir?: string;
  out?: string;
  goal?: string;
  deal?: string;
  id?: string;
  capturedAt?: string;
  skipErrors: boolean;
  fallbackFixture: boolean;
  compact: boolean;
}

const FLAGS_WITH_VALUE = new Set(["--out", "-o", "--goal", "--deal", "--id", "--captured-at"]);

function parseArgs(argv: readonly string[]): ParsedArgs {
  const parsed: ParsedArgs = { command: "", skipErrors: false, fallbackFixture: false, compact: false };
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (FLAGS_WITH_VALUE.has(arg)) {
      const value = argv[++i];
      if (value === undefined) throw new CliUsageError(`flag ${arg} needs a value`);
      switch (arg) {
        case "--out":
        case "-o":
          parsed.out = value;
          break;
        case "--goal":
          parsed.goal = value;
          break;
        case "--deal":
          parsed.deal = value;
          break;
        case "--id":
          parsed.id = value;
          break;
        case "--captured-at":
          parsed.capturedAt = value;
          break;
      }
    } else if (arg === "--skip-errors") {
      parsed.skipErrors = true;
    } else if (arg === "--fallback-fixture") {
      parsed.fallbackFixture = true;
    } else if (arg === "--compact") {
      parsed.compact = true;
    } else if (arg === "-h" || arg === "--help") {
      positionals.unshift("help");
    } else if (arg.startsWith("-")) {
      throw new CliUsageError(`unknown flag: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  parsed.command = positionals[0] ?? "";
  if (positionals[1] !== undefined) parsed.dir = positionals[1];
  return parsed;
}

class CliUsageError extends Error {}

const HELP = `requirements — ingest real source material into an EvidenceBundle (LIM-1333)

USAGE
  node tools/requirements/cli.ts ingest <dir> [options]
  node tools/requirements/cli.ts fixture [--out <file>] [--compact]
  node tools/requirements/cli.ts help

COMMANDS
  ingest <dir>   Normalize a local folder into one cited EvidenceBundle JSON.
  fixture        Emit the deterministic fallback bundle (the pinned Acme golden).
  help           Show this help.

LAYOUT (ingest)
  Drop source files into type folders, or use known extensions / a manifest:
    calls/      *.vtt, [HH:MM:SS] transcripts     -> customer_call
    proposals/  *.md, *.txt                        -> proposal
    sow/        *.md, *.txt                         -> sow
    emails/     *.eml, *.mbox                        -> email
    slack/      *.slack.json                         -> slack
    linear/     *.linear.json                        -> linear
    agent/      *.agent.json                          -> agent_output
  An optional manifest.json declares { id, goalId, dealId, capturedAt, sources }.

OPTIONS
  --goal <id>         scope the bundle to a goal id (or set in manifest.json)
  --deal <id>         scope the bundle to a deal id (or set in manifest.json)
  --id <bundleId>     override the bundle id
  --captured-at <iso> deterministic capture timestamp for every source
  --out, -o <file>    write the bundle JSON to a file (default: stdout)
  --compact           emit compact JSON (default: pretty, 2-space)
  --skip-errors       keep good sources and REPORT failures instead of aborting
  --fallback-fixture  if the folder has no ingestible sources, emit the fixture

NOTES
  A bundle MUST be scoped (goalId and/or dealId). Parser errors are explicit and
  no file is ever silently dropped: failures abort (fail-closed) unless --skip-errors.
`;

function renderSummary(report: IngestReport): string {
  const lines = [
    `ingested ${report.sourceCount} source(s), ${report.chunkCount} chunk(s) -> bundle ${report.bundleId}`,
    `  scope: ${[report.goalId ? `goal=${report.goalId}` : "", report.dealId ? `deal=${report.dealId}` : ""].filter(Boolean).join(" ") || "(none)"}`,
  ];
  for (const s of report.sources) {
    lines.push(`  + ${s.sourceType.padEnd(14)} ${s.chunkCount} chunk(s)  ${s.relPath}`);
  }
  if (report.ignored.length > 0) lines.push(`  ignored (non-source): ${report.ignored.join(", ")}`);
  if (report.failures.length > 0) {
    lines.push(`  FAILURES (reported, not dropped):`);
    for (const f of report.failures) lines.push(`    ! ${f.message}`);
  }
  return lines.join("\n") + "\n";
}

function emitBundle(bundle: EvidenceBundle, parsed: ParsedArgs, deps: CliDeps): void {
  const json = parsed.compact ? JSON.stringify(bundle) : JSON.stringify(bundle, null, 2);
  if (parsed.out !== undefined) {
    const outPath = isAbsolute(parsed.out) ? parsed.out : resolve(deps.cwd, parsed.out);
    writeFileSync(outPath, json + "\n");
    deps.stderr.write(`wrote ${outPath}\n`);
  } else {
    deps.stdout.write(json + "\n");
  }
}

function runIngest(parsed: ParsedArgs, deps: CliDeps): number {
  if (parsed.dir === undefined) {
    deps.stderr.write("error: ingest needs a <dir>\n\n" + HELP);
    return 2;
  }
  const rootDir = isAbsolute(parsed.dir) ? parsed.dir : resolve(deps.cwd, parsed.dir);
  try {
    const { bundle, report } = ingestFolder(rootDir, {
      ...(parsed.goal !== undefined ? { goalId: parsed.goal } : {}),
      ...(parsed.deal !== undefined ? { dealId: parsed.deal } : {}),
      ...(parsed.id !== undefined ? { id: parsed.id } : {}),
      ...(parsed.capturedAt !== undefined ? { capturedAt: parsed.capturedAt } : {}),
      skipErrors: parsed.skipErrors,
    });
    emitBundle(bundle, parsed, deps);
    deps.stderr.write(renderSummary(report));
    return 0;
  } catch (err) {
    // Fixture fallback ONLY for a genuinely sourceless folder (no failures, since a
    // failure without --skip-errors would have aborted earlier) — never masks a parse error.
    if (err instanceof NoSourcesError && parsed.fallbackFixture && !parsed.skipErrors) {
      deps.stderr.write(`warning: ${err.message} — emitting fixture fallback\n`);
      emitBundle(fixtureBundle(), parsed, deps);
      return 0;
    }
    if (err instanceof IngestError) {
      deps.stderr.write(`error: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
}

function runFixture(parsed: ParsedArgs, deps: CliDeps): number {
  emitBundle(fixtureBundle(), parsed, deps);
  deps.stderr.write(`emitted fixture fallback bundle (deterministic Acme golden)\n`);
  return 0;
}

/** Run the CLI. Returns a process exit code. Pure over its injected deps (testable). */
export function runRequirementsCli(argv: readonly string[], deps: CliDeps): number {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    deps.stderr.write(`error: ${(err as Error).message}\n\n${HELP}`);
    return 2;
  }

  switch (parsed.command) {
    case "ingest":
      return runIngest(parsed, deps);
    case "fixture":
      return runFixture(parsed, deps);
    case "help":
    case "":
      deps.stdout.write(HELP);
      return 0;
    default:
      deps.stderr.write(`error: unknown command "${parsed.command}"\n\n${HELP}`);
      return 2;
  }
}

/** True when this module is the process entrypoint (run directly, not imported). */
function isMain(): boolean {
  const argv1 = process.argv[1];
  if (argv1 === undefined) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = runRequirementsCli(process.argv.slice(2), {
    stdout: process.stdout,
    stderr: process.stderr,
    cwd: process.cwd(),
  });
}
