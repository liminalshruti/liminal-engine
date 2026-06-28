/**
 * EvidenceBundle — the normalization target for real source material (call
 * transcripts, proposals, SOWs, Slack/email threads, Linear items, agent outputs)
 * into ONE cited, content-addressed bundle. It is the provenance substrate the rest
 * of the system can point AT: every claim downstream can be traced to a (source,
 * span, content-hash) citation captured here.
 *
 * What it is NOT: it does NOT activate or evaluate requirements. A bundle only
 * PRESERVES cited source material — it has no dependency on (and no opinion about)
 * Requirement / governance logic. Wiring evidence INTO a requirement is a separate
 * concern owned elsewhere; this contract is the leaf that holds the receipts.
 *
 * Data-boundary discipline (the EU-residency / redaction proof, LIM-1248 lineage):
 * the bundle stores raw quoted text BY REFERENCE, never inline. Each `Source` and
 * each `Chunk` carries a `hash` — the REAL sha256 hex of the artifact / quoted span,
 * via the kernel's own `sha256Hex` (no bespoke hash) — so an authorized holder of the
 * raw material can re-hash it and prove a citation matches, while the durable bundle
 * (and its golden values) never carry the secret/customer text itself. Only
 * non-sensitive metadata (a `title`, an optional category `label`, a span locator) is
 * stored in the clear.
 *
 * Like every contract here it ships a snake_case canonical projection + golden
 * vectors so its hash is byte-reproducible across the substrate (Node / browser /
 * Rust `canonical_json`). Arrays are sorted by their stable id in the canonical
 * projection, so the bundle hashes identically regardless of assembly order.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const EVIDENCE_BUNDLE_SCHEMA = "liminal_engine.evidence_bundle.v1";

/**
 * The kinds of real source material a bundle normalizes. `agent_output` is a
 * first-class source: an agent's report is itself cited evidence, captured the same
 * way a human document is.
 */
export const evidenceSourceType = z.enum([
  "customer_call",
  "proposal",
  "sow",
  "slack",
  "email",
  "linear",
  "agent_output",
]);
export type EvidenceSourceType = z.infer<typeof evidenceSourceType>;

/** A real sha256 hex digest (lowercase, 64 chars) — a content reference, never raw text. */
const sha256HexRef = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "must be a lowercase sha256 hex digest (64 hex chars)");

/** The unit a span locator is expressed in (sources are heterogeneous). */
export const evidenceSpanUnit = z.enum([
  "char", // character offset range into the normalized text
  "line", // line / paragraph range
  "page", // page range (documents)
  "section", // section locator (contracts / SOWs, e.g. "7.2")
  "timecode", // audio/video timecode range (e.g. "00:12:30")
  "message", // chat / email message locator
]);
export type EvidenceSpanUnit = z.infer<typeof evidenceSpanUnit>;

/**
 * A span — the located region of a source a chunk cites. `start`/`end` are string
 * locators so one shape covers char offsets, timecodes, sections, etc. A single-point
 * citation may set `start === end`.
 */
export const evidenceSpanShape = z
  .object({
    unit: evidenceSpanUnit,
    start: z.string().min(1),
    end: z.string().min(1),
  })
  .strict();
export type EvidenceSpan = z.infer<typeof evidenceSpanShape>;

/**
 * A normalized source artifact. `hash` is the sha256 of the source's full normalized
 * text — a reproducible content reference; the raw artifact itself is not stored.
 */
export const evidenceSourceShape = z
  .object({
    sourceId: z.string().min(1),
    sourceType: evidenceSourceType,
    /** a NON-sensitive human title, safe to display (not the source's contents). */
    title: z.string().min(1),
    /** sha256 hex of the source's full normalized text — content reference, not raw. */
    hash: sha256HexRef,
    capturedAt: z.string().datetime(),
  })
  .strict();
export type EvidenceSource = z.infer<typeof evidenceSourceShape>;

/**
 * A cited chunk: a stable reference to a `Source` (`sourceId`) plus the `span` within
 * it, committed to by `hash` = sha256 of the exact quoted span. `label` is an OPTIONAL
 * non-sensitive category, safe to display when the raw quote is held by reference.
 */
export const evidenceChunkShape = z
  .object({
    chunkId: z.string().min(1),
    sourceId: z.string().min(1),
    span: evidenceSpanShape,
    /** sha256 hex of the exact quoted span text — content reference, not the quote. */
    hash: sha256HexRef,
    label: z.string().min(1).optional(),
  })
  .strict();
export type EvidenceChunk = z.infer<typeof evidenceChunkShape>;

/**
 * A reference to an agent output normalized into the bundle: the `agentOutputId`
 * (an `AgentOutput` id — referenced, never embedded) and the `sourceId` of the
 * `agent_output` Source it was captured as. Optional on a bundle.
 */
export const evidenceAgentOutputRefShape = z
  .object({
    agentOutputId: z.string().min(1),
    sourceId: z.string().min(1),
  })
  .strict();
export type EvidenceAgentOutputRef = z.infer<typeof evidenceAgentOutputRefShape>;

export const evidenceBundleShape = z
  .object({
    id: z.string().min(1),
    // Scope: a bundle is evidence FOR a goal and/or a deal. At least one is required
    // (enforced below); each is projected into the hash only when present.
    goalId: z.string().min(1).optional(),
    dealId: z.string().min(1).optional(),
    sources: z.array(evidenceSourceShape).min(1),
    chunks: z.array(evidenceChunkShape),
    agentOutputs: z.array(evidenceAgentOutputRefShape).optional(),
  })
  .strict()
  .superRefine((bundle, ctx) => {
    // A bundle must be scoped to something it is evidence for.
    if (bundle.goalId === undefined && bundle.dealId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a bundle must be scoped to a goalId and/or a dealId",
        path: ["dealId"],
      });
    }

    // Source ids are unique.
    const sourceIds = new Set<string>();
    bundle.sources.forEach((s, i) => {
      if (sourceIds.has(s.sourceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate sourceId "${s.sourceId}"`,
          path: ["sources", i, "sourceId"],
        });
      }
      sourceIds.add(s.sourceId);
    });

    // Chunk ids are unique and every chunk cites a known source (stable source refs).
    const chunkIds = new Set<string>();
    bundle.chunks.forEach((c, i) => {
      if (chunkIds.has(c.chunkId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate chunkId "${c.chunkId}"`,
          path: ["chunks", i, "chunkId"],
        });
      }
      chunkIds.add(c.chunkId);
      if (!sourceIds.has(c.sourceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `chunk "${c.chunkId}" cites unknown sourceId "${c.sourceId}"`,
          path: ["chunks", i, "sourceId"],
        });
      }
    });

    // Agent-output refs are unique and must cite an existing `agent_output` Source.
    if (bundle.agentOutputs) {
      const sourceById = new Map(bundle.sources.map((s) => [s.sourceId, s] as const));
      const agentOutputIds = new Set<string>();
      bundle.agentOutputs.forEach((ao, i) => {
        if (agentOutputIds.has(ao.agentOutputId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate agentOutputId "${ao.agentOutputId}"`,
            path: ["agentOutputs", i, "agentOutputId"],
          });
        }
        agentOutputIds.add(ao.agentOutputId);
        const src = sourceById.get(ao.sourceId);
        if (!src) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `agentOutput "${ao.agentOutputId}" cites unknown sourceId "${ao.sourceId}"`,
            path: ["agentOutputs", i, "sourceId"],
          });
        } else if (src.sourceType !== "agent_output") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `agentOutput "${ao.agentOutputId}" must cite an "agent_output" source, not "${src.sourceType}"`,
            path: ["agentOutputs", i, "sourceId"],
          });
        }
      });
    }
  });
export type EvidenceBundle = z.infer<typeof evidenceBundleShape>;

// Locale-INDEPENDENT stable ordering (UTF-16 code-unit compare, like JS default
// string sort) — `localeCompare` is NOT reproducible across ICU versions and would
// break cross-system hash parity. Arrays are ordered by their stable id so a bundle
// hashes identically no matter the assembly order.
const byKey =
  <T>(key: (value: T) => string) =>
  (a: T, b: T): number => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };

export const evidenceBundleContract = defineContract({
  schema: EVIDENCE_BUNDLE_SCHEMA,
  shape: evidenceBundleShape,
  canonical: (b) => ({
    schema: EVIDENCE_BUNDLE_SCHEMA,
    id: b.id,
    ...(b.goalId !== undefined ? { goal_id: b.goalId } : {}),
    ...(b.dealId !== undefined ? { deal_id: b.dealId } : {}),
    sources: [...b.sources].sort(byKey((s) => s.sourceId)).map((s) => ({
      source_id: s.sourceId,
      source_type: s.sourceType,
      title: s.title,
      hash: s.hash,
      captured_at: s.capturedAt,
    })),
    chunks: [...b.chunks].sort(byKey((c) => c.chunkId)).map((c) => ({
      chunk_id: c.chunkId,
      source_id: c.sourceId,
      span: { unit: c.span.unit, start: c.span.start, end: c.span.end },
      hash: c.hash,
      ...(c.label !== undefined ? { label: c.label } : {}),
    })),
    ...(b.agentOutputs !== undefined
      ? {
          agent_outputs: [...b.agentOutputs]
            .sort(byKey((a) => a.agentOutputId))
            .map((a) => ({ agent_output_id: a.agentOutputId, source_id: a.sourceId })),
        }
      : {}),
  }),
});

export const evidenceBundleGoldenVectors = [
  {
    name: "acme-eu-residency-evidence",
    purpose:
      "Acme bundle — call/proposal/sow/email + agent_output sources, cited spans by sha256 ref",
    input: {
      id: "eb_acme_eu_residency",
      goalId: "goal_acme_expansion",
      dealId: "deal_acme",
      sources: [
        {
          sourceId: "src_acme_kickoff_call",
          sourceType: "customer_call",
          title: "Acme expansion kickoff call",
          hash: "e5b72397c57e4314eac2b3ebf436c188d40466c1bfa07073fd63bf4b325efd19",
          capturedAt: "2026-06-27T09:30:00.000Z",
        },
        {
          sourceId: "src_acme_proposal_v3",
          sourceType: "proposal",
          title: "Acme expansion proposal v3",
          hash: "de7b0b08947da982ada52d7763a1d94f8491c1e2bc6f589f168d30e6983e27b8",
          capturedAt: "2026-06-27T09:35:00.000Z",
        },
        {
          sourceId: "src_acme_sow",
          sourceType: "sow",
          title: "Acme statement of work",
          hash: "dadb99e7f64a45e727a4a80299a14cf648fe571ff134985e0db950b13e879deb",
          capturedAt: "2026-06-27T09:40:00.000Z",
        },
        {
          sourceId: "src_acme_procurement_email",
          sourceType: "email",
          title: "Acme procurement thread",
          hash: "ed5d2ccd39e67da9eaf8faa6c8f876ad7e4430d6f167f062f1b1c2c0832e7003",
          capturedAt: "2026-06-27T09:42:00.000Z",
        },
        {
          sourceId: "src_acme_agent_pass1",
          sourceType: "agent_output",
          title: "Deal-desk agent pass 1 report",
          hash: "238473234150d65b87b19f3cf0b1603336c4659e02533330a83b858f9d7ca6a1",
          capturedAt: "2026-06-27T09:45:00.000Z",
        },
      ],
      chunks: [
        {
          chunkId: "ch_eu_residency_call",
          sourceId: "src_acme_kickoff_call",
          span: { unit: "timecode", start: "00:12:30", end: "00:12:58" },
          hash: "0dbc232f9af909068cd7c275eb4d7e52f3a96de25a5634b1362170dc0a03297e",
          label: "eu-data-residency-requirement",
        },
        {
          chunkId: "ch_commercial_terms",
          sourceId: "src_acme_proposal_v3",
          span: { unit: "page", start: "3", end: "3" },
          hash: "3c2c22ec4aa2910d057382dfc4e8dcb2435c9233bc64068346fe9e167dc0ef26",
          label: "commercial-terms",
        },
        {
          chunkId: "ch_missing_residency_sow",
          sourceId: "src_acme_sow",
          span: { unit: "section", start: "7", end: "7.3" },
          hash: "565c7a8532d7780453684f01ffbfc26a32b026b4a1f91a361e30ea3f7dcbcf12",
          label: "missing-eu-residency-clause",
        },
        {
          chunkId: "ch_email_residency_confirm",
          sourceId: "src_acme_procurement_email",
          span: { unit: "char", start: "118", end: "188" },
          hash: "aa4ecf94aae3009e7a7cc32db0ae2304ea93ea42e74f8f3888d96ab42c215ad6",
          label: "procurement-residency-confirmation",
        },
        {
          chunkId: "ch_agent_false_green",
          sourceId: "src_acme_agent_pass1",
          span: { unit: "line", start: "1", end: "1" },
          hash: "d70b31476e2b774a5a59fdc786cdcbd0bfe05d179b33867491fa419c62b67b24",
          label: "reported-status-on-track",
        },
      ],
      agentOutputs: [{ agentOutputId: "ao_acme_p1", sourceId: "src_acme_agent_pass1" }],
    } satisfies EvidenceBundle,
  },
  {
    name: "minimal-single-source",
    purpose: "minimal bundle — one source + one chunk, dealId only, no agent outputs/label",
    input: {
      id: "eb_acme_min",
      dealId: "deal_acme",
      sources: [
        {
          sourceId: "src_acme_kickoff_call",
          sourceType: "customer_call",
          title: "Acme expansion kickoff call",
          hash: "e5b72397c57e4314eac2b3ebf436c188d40466c1bfa07073fd63bf4b325efd19",
          capturedAt: "2026-06-27T09:30:00.000Z",
        },
      ],
      chunks: [
        {
          chunkId: "ch_eu_residency_call",
          sourceId: "src_acme_kickoff_call",
          span: { unit: "timecode", start: "00:12:30", end: "00:12:58" },
          hash: "0dbc232f9af909068cd7c275eb4d7e52f3a96de25a5634b1362170dc0a03297e",
        },
      ],
    } satisfies EvidenceBundle,
  },
];
