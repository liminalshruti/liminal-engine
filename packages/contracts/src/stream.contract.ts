/**
 * Stream — a goal's workflow stream: the agents, artifacts, and flow.
 * Captures the ordered sequence of agent runs, the artifacts they produce,
 * and the dependencies between them. Used for tracing agent activity and
 * understanding the flow of work from goal to outcome.
 * STRETCH: not on the demo spine, but foundational for agent traceability.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const STREAM_SCHEMA = "liminal_engine.stream.v1";

/**
 * A single agent execution within a stream.
 * Each agent contributes one run per pass (first_pass, second_pass, replay).
 */
export const streamAgentRunShape = z.object({
  /** Unique identifier for this agent run. */
  id: z.string().min(1),
  /** The name/role of the agent (e.g., "Product", "Security", "Engineering"). */
  agentRole: z.string().min(1),
  /** Which pass this agent ran in: first_pass, second_pass, or replay. */
  passNumber: z.number().int().positive(),
  /** The AgentOutput ID this run produced. */
  outputId: z.string().min(1),
  /** Timestamp when the agent produced output. */
  executedAt: z.string().datetime(),
  /** Optional: which other agent runs this one depended on (upstream IDs). */
  dependsOn: z.array(z.string().min(1)).default([]),
});
export type StreamAgentRun = z.infer<typeof streamAgentRunShape>;

/**
 * An artifact produced by an agent run: evidence, analysis, or structured data.
 */
export const streamArtifactShape = z.object({
  /** Unique identifier for this artifact. */
  id: z.string().min(1),
  /** Artifact type: e.g., "requirement", "analysis", "transcript", "evidence". */
  type: z.string().min(1),
  /** Human-readable description. */
  label: z.string().min(1),
  /** The agent run that produced this artifact. */
  producedByRunId: z.string().min(1),
  /** Optional: which other artifacts this one was derived from. */
  derivedFrom: z.array(z.string().min(1)).default([]),
});
export type StreamArtifact = z.infer<typeof streamArtifactShape>;

/**
 * The complete workflow stream: ordered agents, artifacts, and their relationships.
 */
export const streamShape = z.object({
  /** Unique identifier for this stream. */
  id: z.string().min(1),
  /** The business goal this stream realizes. */
  goalId: z.string().min(1),
  /** Human-readable name (e.g., "Acme expansion workflow"). */
  name: z.string().min(1),
  /** All agent runs in this stream, in execution order. */
  agentRuns: z.array(streamAgentRunShape).min(1),
  /** All artifacts produced by this stream. */
  artifacts: z.array(streamArtifactShape),
  /** Timestamp when the stream was initialized. */
  createdAt: z.string().datetime(),
  /** Optional: free-form notes on flow or dependencies. */
  notes: z.string().optional(),
});
export type Stream = z.infer<typeof streamShape>;

export const streamContract = defineContract({
  schema: STREAM_SCHEMA,
  shape: streamShape,
  canonical: (s) => ({
    schema: STREAM_SCHEMA,
    id: s.id,
    goal_id: s.goalId,
    name: s.name,
    agent_runs: s.agentRuns.map((run) => ({
      id: run.id,
      agent_role: run.agentRole,
      pass_number: run.passNumber,
      output_id: run.outputId,
      executed_at: run.executedAt,
      depends_on: run.dependsOn ? [...run.dependsOn].sort() : [],
    })),
    artifacts: s.artifacts.map((art) => ({
      id: art.id,
      type: art.type,
      label: art.label,
      produced_by_run_id: art.producedByRunId,
      derived_from: art.derivedFrom ? [...art.derivedFrom].sort() : [],
    })),
    created_at: s.createdAt,
    notes: s.notes,
  }),
});

/**
 * Golden test vectors: one canonical Acme stream showing a 2-pass workflow.
 * First pass: three agents (Product, Security, Engineering) produce initial output.
 * Second pass: same three agents re-run under corrective governance.
 */
export const streamGoldenVectors = [
  {
    name: "acme-two-pass-stream",
    purpose:
      "the complete Acme workflow stream: first-pass false-green + second-pass correction",
    input: {
      id: "stream_acme",
      goalId: "goal_acme_expansion",
      name: "Acme $1.2M expansion workflow",
      agentRuns: [
        // First pass: initial false-green output
        {
          id: "run_product_p1",
          agentRole: "Product",
          passNumber: 1,
          outputId: "ao_acme_p1",
          executedAt: "2026-06-27T09:00:00.000Z",
          dependsOn: [],
        },
        {
          id: "run_security_p1",
          agentRole: "Security",
          passNumber: 1,
          outputId: "ao_acme_p1",
          executedAt: "2026-06-27T09:05:00.000Z",
          dependsOn: [],
        },
        {
          id: "run_engineering_p1",
          agentRole: "Engineering",
          passNumber: 1,
          outputId: "ao_acme_p1",
          executedAt: "2026-06-27T09:10:00.000Z",
          dependsOn: [],
        },
        // Second pass: corrected after governance enforcement
        {
          id: "run_product_p2",
          agentRole: "Product",
          passNumber: 2,
          outputId: "ao_acme_p2",
          executedAt: "2026-06-27T10:00:00.000Z",
          dependsOn: [
            "run_product_p1",
            "run_security_p1",
            "run_engineering_p1",
          ],
        },
        {
          id: "run_security_p2",
          agentRole: "Security",
          passNumber: 2,
          outputId: "ao_acme_p2",
          executedAt: "2026-06-27T10:05:00.000Z",
          dependsOn: [
            "run_product_p1",
            "run_security_p1",
            "run_engineering_p1",
          ],
        },
        {
          id: "run_engineering_p2",
          agentRole: "Engineering",
          passNumber: 2,
          outputId: "ao_acme_p2",
          executedAt: "2026-06-27T10:10:00.000Z",
          dependsOn: [
            "run_product_p1",
            "run_security_p1",
            "run_engineering_p1",
          ],
        },
      ],
      artifacts: [
        // Evidence from the customer call
        {
          id: "art_customer_call_transcript",
          type: "transcript",
          label: "Customer call transcript",
          producedByRunId: "run_product_p1",
          derivedFrom: [],
        },
        // Requirements extracted from the call
        {
          id: "art_requirements_list",
          type: "requirement",
          label: "Extracted requirements (including EU data residency)",
          producedByRunId: "run_product_p1",
          derivedFrom: ["art_customer_call_transcript"],
        },
        // Commercial analysis (first pass)
        {
          id: "art_commercial_analysis_p1",
          type: "analysis",
          label: "Commercial feasibility analysis (pass 1)",
          producedByRunId: "run_product_p1",
          derivedFrom: ["art_requirements_list"],
        },
        // Security assessment (first pass)
        {
          id: "art_security_assessment_p1",
          type: "analysis",
          label: "Security assessment (pass 1)",
          producedByRunId: "run_security_p1",
          derivedFrom: ["art_requirements_list"],
        },
        // Technical feasibility (first pass)
        {
          id: "art_technical_analysis_p1",
          type: "analysis",
          label: "Technical feasibility analysis (pass 1)",
          producedByRunId: "run_engineering_p1",
          derivedFrom: ["art_requirements_list"],
        },
        // Governance case: missing EU residency
        {
          id: "art_governance_case_id",
          type: "evidence",
          label: "Governance case: dropped EU data residency requirement",
          producedByRunId: "run_engineering_p1",
          derivedFrom: [
            "art_requirements_list",
            "art_security_assessment_p1",
          ],
        },
        // Correction enforcement (second pass)
        {
          id: "art_enforcement_action",
          type: "evidence",
          label: "Enforcement action: activate correction policy",
          producedByRunId: "run_engineering_p1",
          derivedFrom: ["art_governance_case_id"],
        },
        // Commercial analysis (second pass)
        {
          id: "art_commercial_analysis_p2",
          type: "analysis",
          label: "Commercial feasibility analysis (pass 2, corrected)",
          producedByRunId: "run_product_p2",
          derivedFrom: [
            "art_requirements_list",
            "art_enforcement_action",
          ],
        },
        // Security assessment (second pass)
        {
          id: "art_security_assessment_p2",
          type: "analysis",
          label: "Security assessment (pass 2, with EU residency owner assigned)",
          producedByRunId: "run_security_p2",
          derivedFrom: [
            "art_requirements_list",
            "art_enforcement_action",
          ],
        },
        // Technical feasibility (second pass)
        {
          id: "art_technical_analysis_p2",
          type: "analysis",
          label: "Technical feasibility (pass 2, EU data residency plan)",
          producedByRunId: "run_engineering_p2",
          derivedFrom: [
            "art_requirements_list",
            "art_enforcement_action",
          ],
        },
        // Eval case
        {
          id: "art_eval_case",
          type: "evidence",
          label: "Eval case: second pass passes all governance checks",
          producedByRunId: "run_engineering_p2",
          derivedFrom: [
            "art_governance_case_id",
            "art_commercial_analysis_p2",
            "art_security_assessment_p2",
            "art_technical_analysis_p2",
          ],
        },
      ],
      createdAt: "2026-06-27T08:00:00.000Z",
      notes:
        "Two-pass workflow: first pass produced a false green (EU residency missed); " +
        "governance correction enforced a second pass with the requirement honored. " +
        "Agents: Product (commercial), Security (data/compliance), Engineering (infrastructure). " +
        "This stream captures the complete artifact lineage and inter-run dependencies.",
    } satisfies Stream,
  },
];
