/**
 * gemini:capture — the LIVE capture trigger.
 *
 * Makes a REAL Gemini call on an arbitrary transcript and writes the resulting AgentOutput
 * into the content-addressed cache, for both pass 1 (first-pass / false-green) and pass 2
 * (corrected re-run). After this runs once with a key, the whole loop replays that real
 * output offline — film-able with no network.
 *
 * Usage:
 *   GEMINI_API_KEY=… pnpm gemini:capture --deal acme_expansion --name "Acme expansion" \
 *     --artifacts customer-call,proposal,launch-plan --file ./transcript.txt
 *   GEMINI_API_KEY=… pnpm gemini:capture --deal d1 --name "Deal" --transcript "raw text…"
 *
 * It NEVER fabricates: with no key it exits non-zero; a malformed model response throws.
 */
import { readFile } from "node:fs/promises";
import { GeminiAgentOutputSource, cacheKeyFor, type AgentInput } from "./index.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.error("✗ GEMINI_API_KEY not set. This script makes a REAL call; it will not fabricate.");
    process.exit(1);
  }

  const dealId = arg("deal") ?? "demo_deal";
  const dealName = arg("name") ?? "Demo deal";
  const artifacts = (arg("artifacts") ?? "customer-call,proposal,launch-plan").split(",").map((s) => s.trim());
  const file = arg("file");
  const inline = arg("transcript");
  const transcript = file ? await readFile(file, "utf8") : inline;

  if (!transcript) {
    console.error("✗ provide --file <path> or --transcript <text> (the arbitrary source material).");
    process.exit(1);
  }

  const input: AgentInput = { dealId, dealName, transcript, artifacts };
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  // Capture via the SAME path the demo uses: getOutput on a cache miss makes the real call
  // and writes the result. One network call per pass — and it proves the production path.
  const source = new GeminiAgentOutputSource();
  source.register(input);

  for (const passNumber of [1, 2] as const) {
    const output = await source.getOutput(dealId, passNumber);
    const key = cacheKeyFor(model, transcript, passNumber);
    console.log(
      `✓ pass ${passNumber}: ${output.reportedStatus} — dropped=[${output.droppedRequirements.join(", ")}] ` +
        `→ cache ${key.slice(0, 12)}…`,
    );
  }
  console.log(`\nCache populated from REAL Gemini calls. The loop now replays this offline.`);
}

main().catch((err) => {
  console.error(`✗ capture failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
