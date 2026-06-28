/**
 * email loader — RFC822-style `.eml` / `.mbox` messages and threads.
 *
 * Parses the leading header block (`From`/`To`/`Subject`/`Date`/`Message-ID`) and
 * the body. A thread is split into individual messages on common separators
 * (mbox `From ` lines, `-----Original Message-----`, `On … wrote:`), and EACH
 * message body becomes a chunk with a `message` span keyed by its `Message-ID`
 * (or a 1-based ordinal when absent). A header-only message with no body still
 * yields a chunk citing the subject line, so nothing is dropped; a totally empty
 * file is a `ParseError`.
 *
 * Subject lines may be sensitive, so they are NOT auto-promoted to the durable
 * source `title` — the title comes from the manifest/filename (see `ingest.ts`).
 */
import { ParseError } from "../errors.ts";
import { normalizeText } from "../normalize.ts";
import { slugify } from "../ids.ts";
import type { ExtractedChunk, LoaderInput, LoaderResult, SourceLoader } from "../types.ts";

const SEPARATORS = [
  /^From .+\d{4}$/, // mbox "From sender date"
  /^-{3,}\s*Original Message\s*-{3,}/i,
  /^On .+wrote:\s*$/,
  /^_{5,}\s*$/,
];

function splitMessages(body: string): string[] {
  const lines = body.split("\n");
  const messages: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    if (SEPARATORS.some((re) => re.test(line)) && buf.join("").trim().length > 0) {
      messages.push(buf.join("\n"));
      buf = [];
    }
    buf.push(line);
  }
  if (buf.join("").trim().length > 0) messages.push(buf.join("\n"));
  return messages.length > 0 ? messages : [body];
}

/** Pull a header value (first match) from a message block's header region. */
function header(block: string, name: string): string | undefined {
  const re = new RegExp(`^${name}:\\s*(.+)$`, "im");
  const m = block.match(re);
  return m ? m[1]!.trim() : undefined;
}

export const emailLoader: SourceLoader = {
  sourceType: "email",
  load(input: LoaderInput): LoaderResult {
    const normalizedText = normalizeText(input.raw);
    if (normalizedText.trim().length === 0) {
      throw new ParseError(input.relPath, "email is empty");
    }

    const messages = splitMessages(normalizedText);
    const chunks: ExtractedChunk[] = [];
    messages.forEach((block, i) => {
      const headerEnd = block.indexOf("\n\n");
      const hasHeaders = /^[A-Za-z-]+:\s/m.test(block.slice(0, headerEnd < 0 ? block.length : headerEnd));
      const body = hasHeaders && headerEnd >= 0 ? block.slice(headerEnd + 2) : block;
      const messageId = header(block, "Message-ID");
      const subject = header(block, "Subject");
      const text = (body.trim().length > 0 ? body : (subject ?? block)).trim();
      if (text.length === 0) return;
      const locator = messageId ? slugify(messageId) : String(i + 1);
      chunks.push({
        span: { unit: "message", start: locator, end: locator },
        text,
        label: "email-message",
      });
    });

    if (chunks.length === 0) {
      throw new ParseError(input.relPath, "no message bodies found in email");
    }
    return { normalizedText, chunks };
  },
};
