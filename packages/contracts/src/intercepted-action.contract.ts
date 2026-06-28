/**
 * InterceptedAction — a consequential agent ACTION held at the intercept gateway,
 * the LIVE/dogfood-track analog of AgentOutput (which captures what an agent
 * *reported*; this captures what an agent is *about to do*). It is the input the
 * policy engine's `decide()` verdicts against. See
 * specs/GOAL-self-learning-policy-loop.md §4 (data model) / §11 (the PR-#20 replay).
 *
 * Mental model = Burp Suite's intercepted request: a structured action on the
 * governed surface (`gh`/`git`/MCP/deploy — e.g. `pr-merge`, `push --force`,
 * `repo fork`, `visibility-change`) carrying the `args` that decide its risk plus
 * the provenance (which agent/session/goal/lane originated it) so every verdict is
 * attributable back to its source.
 *
 * Additive: this is new on the LIVE track and does not touch the locked Acme demo
 * spine. Like every contract it ships a snake_case canonical projection + golden
 * vectors so its hash is byte-reproducible across the substrate.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const INTERCEPTED_ACTION_SCHEMA = "liminal_engine.intercepted_action.v1";

export const interceptedActionShape = z.object({
  id: z.string().min(1),
  /** the governed tool surface — e.g. "gh" | "git" | "mcp" | "deploy" */
  tool: z.string().min(1),
  /** the consequential action — e.g. "pr-merge" | "push" | "fork" | "visibility-change" */
  action: z.string().min(1),
  /** what the action targets — e.g. a repo or PR (optional; some actions are target-less) */
  target: z.string().min(1).optional(),
  /** the structured arguments that decide the action's risk (e.g. review counts, flags) */
  args: z.record(z.unknown()),
  // Provenance — optional but typed; lets every verdict be attributed to its source.
  agentId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  goalId: z.string().min(1).optional(),
  lane: z.string().min(1).optional(),
  requestedAt: z.string().datetime(),
});
export type InterceptedAction = z.infer<typeof interceptedActionShape>;

export const interceptedActionContract = defineContract({
  schema: INTERCEPTED_ACTION_SCHEMA,
  shape: interceptedActionShape,
  canonical: (a) => ({
    schema: INTERCEPTED_ACTION_SCHEMA,
    id: a.id,
    tool: a.tool,
    action: a.action,
    ...(a.target !== undefined ? { target: a.target } : {}),
    args: a.args,
    // provenance — only projected into the hash when present
    ...(a.agentId !== undefined ? { agent_id: a.agentId } : {}),
    ...(a.sessionId !== undefined ? { session_id: a.sessionId } : {}),
    ...(a.goalId !== undefined ? { goal_id: a.goalId } : {}),
    ...(a.lane !== undefined ? { lane: a.lane } : {}),
    requested_at: a.requestedAt,
  }),
});

export const interceptedActionGoldenVectors = [
  {
    name: "pr20-merge-intercepted",
    purpose: "the PR-#20 replay action — gh pr-merge with split reviews, full provenance",
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
    purpose: "minimal action — required fields only; optional target/provenance omitted",
    input: {
      id: "ia_git_force_push",
      tool: "git",
      action: "push",
      args: { force: true, ref: "main" },
      requestedAt: "2026-06-27T10:01:00.000Z",
    } satisfies InterceptedAction,
  },
];
