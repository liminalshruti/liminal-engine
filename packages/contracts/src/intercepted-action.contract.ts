/**
 * InterceptedAction - a consequential agent action held at the intercept gateway.
 *
 * This is the live/dogfood-track analog of AgentOutput: AgentOutput captures what
 * an agent reported, while InterceptedAction captures what an agent is about to
 * do. It is intentionally additive and does not touch the deterministic Acme
 * demo spine.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const INTERCEPTED_ACTION_SCHEMA = "liminal_engine.intercepted_action.v1";

export const interceptedActionShape = z.object({
  id: z.string().min(1),
  tool: z.string().min(1),
  action: z.string().min(1),
  target: z.string().min(1).optional(),
  args: z.record(z.unknown()),
  agentId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  goalId: z.string().min(1).optional(),
  lane: z.string().min(1).optional(),
  requestedAt: z.string().datetime(),
}).strict();
export type InterceptedAction = z.infer<typeof interceptedActionShape>;

export const interceptedActionContract = defineContract({
  schema: INTERCEPTED_ACTION_SCHEMA,
  shape: interceptedActionShape,
  canonical: (action) => ({
    schema: INTERCEPTED_ACTION_SCHEMA,
    id: action.id,
    tool: action.tool,
    action: action.action,
    ...(action.target !== undefined ? { target: action.target } : {}),
    args: action.args,
    ...(action.agentId !== undefined ? { agent_id: action.agentId } : {}),
    ...(action.sessionId !== undefined ? { session_id: action.sessionId } : {}),
    ...(action.goalId !== undefined ? { goal_id: action.goalId } : {}),
    ...(action.lane !== undefined ? { lane: action.lane } : {}),
    requested_at: action.requestedAt,
  }),
});

export const interceptedActionGoldenVectors = [
  {
    name: "pr20-merge-intercepted",
    purpose: "the PR-#20 replay action - gh pr-merge with split reviews, full provenance",
    input: {
      id: "ia_pr20_merge",
      tool: "gh",
      action: "pr-merge",
      target: "PR#20",
      args: { reviews: { approved: 1, rejected: 1 } },
      agentId: "claude-implementer",
      sessionId: "sess_pr20_replay",
      goalId: "LIM-1266",
      lane: "shayaun-main",
      requestedAt: "2026-06-27T10:00:00.000Z",
    } satisfies InterceptedAction,
  },
  {
    name: "git-force-push-minimal",
    purpose: "minimal action - required fields only; optional target/provenance omitted",
    input: {
      id: "ia_git_force_push",
      tool: "git",
      action: "push",
      args: { force: true, ref: "main" },
      requestedAt: "2026-06-27T10:01:00.000Z",
    } satisfies InterceptedAction,
  },
];
