/**
 * Source-type routing — decide which of the seven `EvidenceSourceType`s a file is.
 *
 * Resolution order (most explicit wins):
 *   1. manifest per-file override (`sources[relPath].type`)
 *   2. the immediate parent directory name, via a synonym table (the primary,
 *      arbitrary-data-friendly convention: drop files into `calls/`, `sow/`, …)
 *   3. a filename/extension heuristic (`.vtt` → call, `.eml` → email, `.slack.json`
 *      → slack, …)
 *
 * If NONE of these classify the file, routing raises `UnclassifiedFileError`
 * (errors.ts) — it never guesses, and never silently skips the file. That is what
 * keeps "parser errors are explicit and never silently drop files" true at the
 * classification stage.
 */
import { UnclassifiedFileError } from "./errors.ts";
import { evidenceSourceType, type EvidenceSourceType } from "./contracts.ts";

const SOURCE_TYPES = new Set<string>(evidenceSourceType.options);

/** Directory-name synonyms → canonical source type. */
const DIR_SYNONYMS: Record<string, EvidenceSourceType> = {
  call: "customer_call",
  calls: "customer_call",
  customer_call: "customer_call",
  customer_calls: "customer_call",
  transcript: "customer_call",
  transcripts: "customer_call",
  meeting: "customer_call",
  meetings: "customer_call",
  proposal: "proposal",
  proposals: "proposal",
  sow: "sow",
  sows: "sow",
  statement_of_work: "sow",
  statements_of_work: "sow",
  email: "email",
  emails: "email",
  mail: "email",
  slack: "slack",
  linear: "linear",
  agent: "agent_output",
  agents: "agent_output",
  agent_output: "agent_output",
  agent_outputs: "agent_output",
};

/** Filename/extension heuristics → canonical source type. */
function byFileName(fileName: string): EvidenceSourceType | undefined {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".slack.json")) return "slack";
  if (lower.endsWith(".linear.json")) return "linear";
  if (lower.endsWith(".agent.json")) return "agent_output";
  if (lower.endsWith(".vtt")) return "customer_call";
  if (lower.endsWith(".eml") || lower.endsWith(".email")) return "email";
  if (lower.endsWith(".mbox")) return "email";
  return undefined;
}

const norm = (segment: string): string => segment.toLowerCase().replace(/[\s-]+/g, "_");

export interface RouteContext {
  /** path relative to the ingest root (POSIX separators). */
  readonly relPath: string;
  /** the base file name. */
  readonly fileName: string;
  /** the immediate parent directory name relative to the root ("" if at root). */
  readonly parentDir: string;
  /** an explicit per-file type override from the manifest, if any. */
  readonly overrideType?: string;
}

/**
 * Classify a file into a source type, or throw `UnclassifiedFileError`. An invalid
 * manifest override (not one of the seven types) is itself an explicit error.
 */
export function routeSourceType(ctx: RouteContext): EvidenceSourceType {
  if (ctx.overrideType !== undefined) {
    if (!SOURCE_TYPES.has(ctx.overrideType)) {
      throw new UnclassifiedFileError(
        ctx.relPath,
        `manifest type "${ctx.overrideType}" is not one of: ${evidenceSourceType.options.join(", ")}`,
      );
    }
    return ctx.overrideType as EvidenceSourceType;
  }

  const dirType = DIR_SYNONYMS[norm(ctx.parentDir)];
  if (dirType !== undefined) return dirType;

  const fileType = byFileName(ctx.fileName);
  if (fileType !== undefined) return fileType;

  throw new UnclassifiedFileError(
    ctx.relPath,
    "no type folder (e.g. calls/ proposals/ sow/ emails/ slack/ linear/ agent/), " +
      "no known extension (.vtt .eml .slack.json .linear.json .agent.json), " +
      "and no manifest override",
  );
}
