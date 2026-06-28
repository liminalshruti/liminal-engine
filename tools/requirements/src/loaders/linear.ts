/**
 * linear loader — a Linear-export JSON file (`.linear.json`).
 *
 * Accepts `{ issues: [...] }` or a bare array of issues. Each issue becomes a chunk
 * citing `title` + `description`, with a `section` span keyed by the issue
 * `identifier` (e.g. "LIM-1") — or a 1-based ordinal if absent — committed to by
 * `sha256(title\n\ndescription)`.
 *
 * The normalized source text is a deterministic `identifier\ttitle\tdescription`
 * projection so the source hash is reproducible regardless of raw key order.
 * Malformed JSON, a non-array/object root, or zero citable issues is a `ParseError`.
 */
import { ParseError } from "../errors.ts";
import { slugify } from "../ids.ts";
import type { ExtractedChunk, LoaderInput, LoaderResult, SourceLoader } from "../types.ts";

interface LinearIssue {
  identifier?: unknown;
  id?: unknown;
  title?: unknown;
  description?: unknown;
  state?: unknown;
}

function asIssues(root: unknown, relPath: string): LinearIssue[] {
  if (Array.isArray(root)) return root as LinearIssue[];
  if (root !== null && typeof root === "object" && Array.isArray((root as { issues?: unknown }).issues)) {
    return (root as { issues: LinearIssue[] }).issues;
  }
  throw new ParseError(relPath, "expected a JSON array of issues or { issues: [...] }");
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

export const linearLoader: SourceLoader = {
  sourceType: "linear",
  load(input: LoaderInput): LoaderResult {
    let root: unknown;
    try {
      root = JSON.parse(input.raw);
    } catch (err) {
      throw new ParseError(input.relPath, `not valid JSON: ${(err as Error).message}`);
    }
    const issues = asIssues(root, input.relPath);

    const chunks: ExtractedChunk[] = [];
    const projection: string[] = [];
    issues.forEach((issue, i) => {
      const title = str(issue.title);
      const description = str(issue.description);
      if (title === undefined && description === undefined) return;
      const locator = str(issue.identifier) ?? str(issue.id) ?? String(i + 1);
      const text = [title, description].filter((p): p is string => p !== undefined).join("\n\n");
      projection.push(`${locator}\t${title ?? ""}\t${description ?? ""}`);
      chunks.push({
        span: { unit: "section", start: slugify(locator), end: slugify(locator) },
        text,
        label: "linear-issue",
      });
    });

    if (chunks.length === 0) {
      throw new ParseError(input.relPath, "no issues with a title or description found");
    }
    return { normalizedText: projection.join("\n"), chunks };
  },
};
