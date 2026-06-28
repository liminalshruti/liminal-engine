/**
 * LinearWorkstreamPayload — the simulated Linear workstream an EnforcementAction
 * of type `create_linear_workstream` carries (DEMO_CONTRACT step 8 / must-not-cut
 * #4: the workstream demands Product / Security / Engineering owners). Simulated,
 * never a live Linear API call (DEMO_CONTRACT cut-if-risky).
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const LINEAR_WORKSTREAM_PAYLOAD_SCHEMA = "liminal_engine.linear_workstream_payload.v1";

export const linearWorkstreamPayloadShape = z.object({
  title: z.string().min(1),
  dealId: z.string().min(1),
  /** Owners the workstream requires before a corrected update can proceed. */
  requiredOwners: z.array(z.string().min(1)),
  workstreams: z.array(
    z.object({
      title: z.string().min(1),
      status: z.string().min(1),
      owner: z.string().min(1),
    }),
  ),
});
export type LinearWorkstreamPayload = z.infer<typeof linearWorkstreamPayloadShape>;

export const linearWorkstreamPayloadContract = defineContract({
  schema: LINEAR_WORKSTREAM_PAYLOAD_SCHEMA,
  shape: linearWorkstreamPayloadShape,
  canonical: (p) => ({
    schema: LINEAR_WORKSTREAM_PAYLOAD_SCHEMA,
    title: p.title,
    deal_id: p.dealId,
    required_owners: p.requiredOwners,
    workstreams: p.workstreams.map((w) => ({
      title: w.title,
      status: w.status,
      owner: w.owner,
    })),
  }),
});

export const linearWorkstreamPayloadGoldenVectors = [
  {
    name: "acme-remediation-workstream",
    purpose: "remediation workstream requires Product/Security/Engineering owners",
    input: {
      title: "Acme expansion — EU data residency remediation",
      dealId: "deal_acme",
      requiredOwners: ["Product", "Security", "Engineering"],
      workstreams: [
        { title: "Commercial terms", status: "green", owner: "Product" },
        { title: "Security review", status: "green", owner: "Security" },
        { title: "Data residency (EU)", status: "at-risk", owner: "Engineering" },
      ],
    } satisfies LinearWorkstreamPayload,
  },
];
