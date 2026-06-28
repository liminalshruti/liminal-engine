/**
 * slack loader — a Slack-export JSON file (`.slack.json`).
 *
 * Accepts either a bare array of message objects or `{ messages: [...] }` (both are
 * shapes Slack's export / common dumps produce). Each message with text becomes a
 * chunk with a `message` span keyed by the message `ts` (timestamp id) — or a 1-based
 * ordinal if absent — committed to by `sha256(text)`.
 *
 * The normalized source text is a DETERMINISTIC `ts\tuser\ttext` projection (stable
 * regardless of key order in the raw JSON), so the source hash is reproducible.
 * Malformed JSON, a non-array/object root, or zero text messages is a `ParseError`.
 */
import { ParseError } from "../errors.ts";
import type { ExtractedChunk, LoaderInput, LoaderResult, SourceLoader } from "../types.ts";

interface SlackMessage {
  ts?: unknown;
  user?: unknown;
  username?: unknown;
  text?: unknown;
}

function asMessages(root: unknown, relPath: string): SlackMessage[] {
  if (Array.isArray(root)) return root as SlackMessage[];
  if (root !== null && typeof root === "object" && Array.isArray((root as { messages?: unknown }).messages)) {
    return (root as { messages: SlackMessage[] }).messages;
  }
  throw new ParseError(relPath, "expected a JSON array of messages or { messages: [...] }");
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

export const slackLoader: SourceLoader = {
  sourceType: "slack",
  load(input: LoaderInput): LoaderResult {
    let root: unknown;
    try {
      root = JSON.parse(input.raw);
    } catch (err) {
      throw new ParseError(input.relPath, `not valid JSON: ${(err as Error).message}`);
    }
    const messages = asMessages(root, input.relPath);

    const chunks: ExtractedChunk[] = [];
    const projection: string[] = [];
    messages.forEach((msg, i) => {
      const text = str(msg.text);
      const ts = str(msg.ts) ?? String(i + 1);
      const user = str(msg.user) ?? str(msg.username) ?? "unknown";
      if (text === undefined) return;
      projection.push(`${ts}\t${user}\t${text}`);
      chunks.push({
        span: { unit: "message", start: ts, end: ts },
        text,
        label: "slack-message",
      });
    });

    if (chunks.length === 0) {
      throw new ParseError(input.relPath, "no messages with text found");
    }
    return { normalizedText: projection.join("\n"), chunks };
  },
};
