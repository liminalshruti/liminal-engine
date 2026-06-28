# Gemini response cache

Content-addressed cache of **real** Gemini `AgentOutput` responses, so the governance
loop replays live inference **offline and deterministically** — the directive's "operate on
arbitrary data" path, film-able with no network.

## How entries get here (the only way)

`pnpm gemini:capture` makes a **real** `generateContent` call and writes the validated
response here. Nothing else writes this directory. The adapter never fabricates output:
a cache miss with no `GEMINI_API_KEY` throws `GeminiCacheMiss` rather than inventing an answer.

```bash
GEMINI_API_KEY=…  pnpm gemini:capture \
  --deal acme_expansion --name "Acme expansion" \
  --artifacts customer-call,proposal,launch-plan \
  --file ./my-transcript.txt
```

This captures **pass 1** (first-pass / false-green) and **pass 2** (corrected re-run).

## File format

- **Filename:** `<sha256(model + "\n" + passNumber + "\n" + transcript)>.json` — replay is
  bound to the exact model + pass + input that produced it.
- **Contents:** one contract-valid `AgentOutput` (validated on read; a corrupt file is
  ignored, never served as a real answer).

```json
{
  "id": "ao_acme_p1",
  "dealId": "acme_expansion",
  "dealName": "Acme expansion",
  "passNumber": 1,
  "reportedStatus": "on-track",
  "summary": "Acme $1.2M expansion on track; all workstreams green.",
  "droppedRequirements": ["EU data residency"],
  "agentMetadata": { "agent": "Gemini", "model": "gemini-2.0-flash",
    "artifacts": ["customer-call", "proposal", "launch-plan"] }
}
```

`agentMetadata` is forced to the truth of the call that produced it (the model can't
misreport what generated it). Committing these files is intentional — they are the real,
captured evidence the demo replays.
