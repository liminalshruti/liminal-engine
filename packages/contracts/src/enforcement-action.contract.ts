/**
 * EnforcementAction — the Approve + Enforce action that visibly changes status
 * (On Track → At Risk). DEMO_CONTRACT must-not-cut #3. Distinct from AuditEvent
 * (#6): the action is the command the operator takes; the AuditEvent is the
 * recorded evidence of it.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";
import { dealStatus } from "./agent-output.contract.ts";

export const ENFORCEMENT_ACTION_SCHEMA = "liminal_engine.enforcement_action.v1";

/**
 * The fixed set of enforcement effects (per specs/SPEC.md) — a closed enum, NOT a
 * policy DSL. The gov-correct correction templates compile ONTO these.
 */
export const enforcementActionType = z.enum([
  "change_status",
  "create_linear_workstream",
  "assign_owner",
  "block_agent_action",
  "require_approval",
  "generate_eval",
  "activate_policy",
  "record_audit_event",
]);
export type EnforcementActionType = z.infer<typeof enforcementActionType>;

export const enforcementActionShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  dealId: z.string().min(1),
  fromStatus: dealStatus,
  toStatus: dealStatus,
  actor: z.string().min(1), // a ROLE, never an invented persona name
  enforcedAt: z.string().datetime(),
  // SPEC.md extensions — optional; only projected into the hash when present.
  actionType: enforcementActionType.optional(),
  targetSystem: z.string().min(1).optional(),
  payload: z.record(z.unknown()).optional(),
});
export type EnforcementAction = z.infer<typeof enforcementActionShape>;

export const enforcementActionContract = defineContract({
  schema: ENFORCEMENT_ACTION_SCHEMA,
  shape: enforcementActionShape,
  canonical: (a) => ({
    schema: ENFORCEMENT_ACTION_SCHEMA,
    id: a.id,
    case_id: a.caseId,
    deal_id: a.dealId,
    from_status: a.fromStatus,
    to_status: a.toStatus,
    actor: a.actor,
    enforced_at: a.enforcedAt,
    ...(a.actionType !== undefined ? { action_type: a.actionType } : {}),
    ...(a.targetSystem !== undefined ? { target_system: a.targetSystem } : {}),
    ...(a.payload !== undefined ? { payload: a.payload } : {}),
  }),
});

export const enforcementActionGoldenVectors = [
  {
    name: "acme-approve-enforce",
    purpose: "Approve + Enforce flips on-track -> at-risk",
    input: {
      id: "ea_acme_enforce",
      caseId: "gc_acme_eu",
      dealId: "deal_acme",
      fromStatus: "on-track",
      toStatus: "at-risk",
      actor: "VP Ops / Head of AI Transformation",
      enforcedAt: "2026-06-27T10:04:00.000Z",
    } satisfies EnforcementAction,
  },
];
