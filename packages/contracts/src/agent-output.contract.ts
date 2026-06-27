/**
 * AgentOutput — what the resourced AI agents reported for a deal.
 * The "false green": reportedStatus = "on-track" while droppedRequirements is
 * non-empty (a load-bearing requirement was silently dropped). See DEMO_CONTRACT.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const AGENT_OUTPUT_SCHEMA = "liminal_engine.agent_output.v1";

export const dealStatus = z.enum(["on-track", "at-risk"]);
export type DealStatus = z.infer<typeof dealStatus>;

export const agentOutputShape = z.object({
  id: z.string().min(1),
  dealId: z.string().min(1),
  dealName: z.string().min(1),
  passNumber: z.number().int().positive(),
  reportedStatus: dealStatus,
  summary: z.string().min(1),
  droppedRequirements: z.array(z.string().min(1)), // silently dropped; empty after correction
});
export type AgentOutput = z.infer<typeof agentOutputShape>;

export const agentOutputContract = defineContract({
  schema: AGENT_OUTPUT_SCHEMA,
  shape: agentOutputShape,
  canonical: (o) => ({
    schema: AGENT_OUTPUT_SCHEMA,
    id: o.id,
    deal_id: o.dealId,
    deal_name: o.dealName,
    pass_number: o.passNumber,
    reported_status: o.reportedStatus,
    summary: o.summary,
    dropped_requirements: [...o.droppedRequirements].sort(), // order-stable
  }),
});

export const agentOutputGoldenVectors = [
  {
    name: "false-green-pass1",
    purpose: "the false green — on-track while a requirement was dropped",
    input: {
      id: "ao_acme_p1",
      dealId: "deal_acme",
      dealName: "Acme expansion",
      passNumber: 1,
      reportedStatus: "on-track",
      summary: "Acme $1.2M expansion on track; all workstreams green.",
      droppedRequirements: ["EU data residency"],
    } satisfies AgentOutput,
  },
];
