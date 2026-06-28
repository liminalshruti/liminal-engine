/**
 * ResourceAllocation — mapping of agents, humans, timeline, and cost to a governance case.
 * Enables governance-ROI analysis and resource planning. (specs/IDEAS.md: FUTURE.)
 *
 * Captures:
 * - Which agents ran (and their cost/tokens/latency)
 * - Which humans were involved (roles, effort)
 * - Timeline: when detection, correction, enforcement occurred
 * - Cost breakdown: agent inference, human review, computational overhead
 *
 * This is a FUTURE contract; fixtures + tests only, no UI or live integration.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const RESOURCE_ALLOCATION_SCHEMA = "liminal_engine.resource_allocation.v1";

export const agentResourceShape = z.object({
  agentId: z.string().min(1),
  agentRole: z.string().min(1), // e.g., "detector", "compliance-checker"
  runCount: z.number().int().nonnegative(),
  totalTokensUsed: z.number().int().nonnegative(),
  totalLatencyMs: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().min(0),
});
export type AgentResource = z.infer<typeof agentResourceShape>;

export const humanResourceShape = z.object({
  role: z.string().min(1), // e.g., "VP Ops", "Security Lead" — never an invented persona name
  effortHours: z.number().min(0),
  estimatedCostUsd: z.number().min(0),
  activities: z.array(z.string().min(1)), // e.g., ["reviewed case", "approved enforcement", "attended followup"]
});
export type HumanResource = z.infer<typeof humanResourceShape>;

export const timelineEventShape = z.object({
  eventType: z.enum([
    "case_opened",
    "correction_submitted",
    "enforcement_approved",
    "enforcement_executed",
    "eval_passed",
    "case_closed",
  ]),
  occurredAt: z.string().datetime(),
  actorType: z.enum(["agent", "human"]), // who/what drove this event
  actor: z.string().min(1),
  durationMs: z.number().int().nonnegative().optional(), // time spent on this step
});
export type TimelineEvent = z.infer<typeof timelineEventShape>;

export const resourceAllocationShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1), // links to the GovernanceCase this allocation covers
  dealId: z.string().min(1),

  // Agent resources
  agents: z.array(agentResourceShape),
  totalAgentTokensUsed: z.number().int().nonnegative(),
  totalAgentCostUsd: z.number().min(0),

  // Human resources
  humans: z.array(humanResourceShape),
  totalHumanHours: z.number().min(0),
  totalHumanCostUsd: z.number().min(0),

  // Timeline
  timeline: z.array(timelineEventShape),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(), // null if case still open
  totalDurationMs: z.number().int().nonnegative(),

  // Governance ROI
  /** The value (in days of delay prevented, $ of deal risk mitigated, etc.) */
  governanceValue: z.string().min(1),
  /** Ratio of value delivered to cost incurred; textual for now (e.g., "1.2M$ risk / $50 cost = 24k:1") */
  roiRatio: z.string().min(1).optional(),

  createdAt: z.string().datetime(),
});
export type ResourceAllocation = z.infer<typeof resourceAllocationShape>;

export const resourceAllocationContract = defineContract({
  schema: RESOURCE_ALLOCATION_SCHEMA,
  shape: resourceAllocationShape,
  canonical: (r) => ({
    schema: RESOURCE_ALLOCATION_SCHEMA,
    id: r.id,
    case_id: r.caseId,
    deal_id: r.dealId,
    agents: r.agents.map((a) => ({
      agent_id: a.agentId,
      agent_role: a.agentRole,
      run_count: a.runCount,
      total_tokens_used: a.totalTokensUsed,
      total_latency_ms: a.totalLatencyMs,
      estimated_cost_usd: a.estimatedCostUsd,
    })),
    total_agent_tokens_used: r.totalAgentTokensUsed,
    total_agent_cost_usd: r.totalAgentCostUsd,
    humans: r.humans.map((h) => ({
      role: h.role,
      effort_hours: h.effortHours,
      estimated_cost_usd: h.estimatedCostUsd,
      activities: h.activities,
    })),
    total_human_hours: r.totalHumanHours,
    total_human_cost_usd: r.totalHumanCostUsd,
    timeline: r.timeline.map((t) => ({
      event_type: t.eventType,
      occurred_at: t.occurredAt,
      actor_type: t.actorType,
      actor: t.actor,
      ...(t.durationMs !== undefined ? { duration_ms: t.durationMs } : {}),
    })),
    start_time: r.startTime,
    ...(r.endTime !== undefined ? { end_time: r.endTime } : {}),
    total_duration_ms: r.totalDurationMs,
    governance_value: r.governanceValue,
    ...(r.roiRatio !== undefined ? { roi_ratio: r.roiRatio } : {}),
    created_at: r.createdAt,
  }),
});

export const resourceAllocationGoldenVectors = [
  {
    name: "acme-eu-residency-allocation",
    purpose: "Resource allocation for the Acme EU data residency governance case",
    input: {
      id: "ra_acme_eu",
      caseId: "gc_acme_eu",
      dealId: "deal_acme",

      // Detector + compliance agents used
      agents: [
        {
          agentId: "agent_detector_v1",
          agentRole: "detector",
          runCount: 2,
          totalTokensUsed: 4500,
          totalLatencyMs: 2300,
          estimatedCostUsd: 0.32,
        },
        {
          agentId: "agent_compliance_v2",
          agentRole: "compliance-checker",
          runCount: 1,
          totalTokensUsed: 3200,
          totalLatencyMs: 1800,
          estimatedCostUsd: 0.18,
        },
      ],
      totalAgentTokensUsed: 7700,
      totalAgentCostUsd: 0.50,

      // VP Ops review, Security Lead coordination
      humans: [
        {
          role: "VP Ops / Head of AI Transformation",
          effortHours: 0.75,
          estimatedCostUsd: 150.0,
          activities: ["reviewed case", "approved enforcement", "coordinated second pass"],
        },
        {
          role: "Security Lead",
          effortHours: 0.5,
          estimatedCostUsd: 125.0,
          activities: ["validated EU residency requirements", "proposed mitigation"],
        },
      ],
      totalHumanHours: 1.25,
      totalHumanCostUsd: 275.0,

      // Timeline of events
      timeline: [
        {
          eventType: "case_opened",
          occurredAt: "2026-06-27T10:00:00.000Z",
          actorType: "agent",
          actor: "agent_detector_v1",
          durationMs: 2300,
        },
        {
          eventType: "correction_submitted",
          occurredAt: "2026-06-27T10:15:00.000Z",
          actorType: "human",
          actor: "VP Ops / Head of AI Transformation",
          durationMs: 900000, // 15 minutes to review
        },
        {
          eventType: "enforcement_approved",
          occurredAt: "2026-06-27T10:18:00.000Z",
          actorType: "human",
          actor: "VP Ops / Head of AI Transformation",
          durationMs: 180000, // 3 minutes to approve
        },
        {
          eventType: "enforcement_executed",
          occurredAt: "2026-06-27T10:20:00.000Z",
          actorType: "agent",
          actor: "agent_detector_v1",
          durationMs: 500, // fast status flip
        },
        {
          eventType: "eval_passed",
          occurredAt: "2026-06-27T10:35:00.000Z",
          actorType: "agent",
          actor: "agent_compliance_v2",
          durationMs: 1800,
        },
        {
          eventType: "case_closed",
          occurredAt: "2026-06-27T10:40:00.000Z",
          actorType: "human",
          actor: "VP Ops / Head of AI Transformation",
          durationMs: 120000, // 2 minutes final review
        },
      ],
      startTime: "2026-06-27T10:00:00.000Z",
      endTime: "2026-06-27T10:40:00.000Z",
      totalDurationMs: 2400000, // 40 minutes total

      // ROI: caught a false-green on a $1.2M deal
      governanceValue: "Prevented false-green status on $1.2M deal; enforced EU data residency requirement before customer escalation",
      roiRatio: "$1,200,000 deal risk / $275.50 cost ≈ 4,355:1",

      createdAt: "2026-06-27T10:40:00.000Z",
    } satisfies ResourceAllocation,
  },
];
