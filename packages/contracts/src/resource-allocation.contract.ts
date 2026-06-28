/**
 * ResourceAllocation — assignment of a role, agent, budget, compute, calendar,
 * or integration resource to a governed work item.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const RESOURCE_ALLOCATION_SCHEMA = "liminal_engine.resource_allocation.v1";

export const resourceType = z.enum(["role", "agent", "budget", "compute", "calendar", "integration"]);
export type ResourceType = z.infer<typeof resourceType>;

export const resourceAllocationStatus = z.enum(["requested", "allocated", "active", "blocked", "released"]);
export type ResourceAllocationStatus = z.infer<typeof resourceAllocationStatus>;

export const resourceAmountShape = z
  .object({
    value: z.number().nonnegative(),
    unit: z.string().min(1),
  })
  .strict();
export type ResourceAmount = z.infer<typeof resourceAmountShape>;

export const resourceAllocationShape = z
  .object({
    id: z.string().min(1),
    workItemId: z.string().min(1),
    resourceType,
    ownerRole: z.string().min(1),
    amount: resourceAmountShape.optional(),
    status: resourceAllocationStatus,
    reason: z.string().min(1),
    constraints: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)).optional(),
    allocatedAt: z.string().datetime().optional(),
    releasedAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((allocation, ctx) => {
    if ((allocation.status === "allocated" || allocation.status === "active") && allocation.allocatedAt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${allocation.status} allocations require allocatedAt`,
        path: ["allocatedAt"],
      });
    }
    if (allocation.status === "released" && allocation.releasedAt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "released allocations require releasedAt",
        path: ["releasedAt"],
      });
    }
  });
export type ResourceAllocation = z.infer<typeof resourceAllocationShape>;

export const resourceAllocationContract = defineContract({
  schema: RESOURCE_ALLOCATION_SCHEMA,
  shape: resourceAllocationShape,
  canonical: (a) => ({
    schema: RESOURCE_ALLOCATION_SCHEMA,
    id: a.id,
    work_item_id: a.workItemId,
    resource_type: a.resourceType,
    owner_role: a.ownerRole,
    ...(a.amount !== undefined ? { amount: { value: a.amount.value, unit: a.amount.unit } } : {}),
    status: a.status,
    reason: a.reason,
    constraints: [...a.constraints].sort(),
    ...(a.evidenceIds !== undefined ? { evidence_ids: [...a.evidenceIds].sort() } : {}),
    ...(a.allocatedAt !== undefined ? { allocated_at: a.allocatedAt } : {}),
    ...(a.releasedAt !== undefined ? { released_at: a.releasedAt } : {}),
  }),
});

export const resourceAllocationGoldenVectors = [
  {
    name: "acme-security-owner-allocation",
    purpose: "Security owner allocated to close the EU data residency resource gap",
    input: {
      id: "ra_acme_security_owner",
      workItemId: "gc_acme_eu",
      resourceType: "role",
      ownerRole: "Security",
      status: "allocated",
      reason: "EU data residency requires Security ownership before customer-facing updates.",
      constraints: ["EU data residency", "customer-facing-status-update"],
      evidenceIds: ["ds_acme_eu_residency"],
      allocatedAt: "2026-06-27T10:04:00.000Z",
    } satisfies ResourceAllocation,
  },
];
