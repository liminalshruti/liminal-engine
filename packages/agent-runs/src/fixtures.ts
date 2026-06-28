/**
 * AgentRun fixtures for the Acme false-green scenario.
 *
 * SINGLE SOURCE (parallel to contracts/fixtures/acme.ts): these fixtures seed
 * the agent-run lifecycle for multi-pass scenarios. Pass 1 has no parent; Pass 2
 * is linked to Pass 1 via parentRunId, proving the governance-loop output
 * (agent run 2 outputs the enforced goal state).
 */
import { agentRunContract, type AgentRun } from "./agent-run.contract.ts";

/** Pass 1 run: the false green. Parent is null (start of sequence). */
export const acmeAgentRunPass1: AgentRun = agentRunContract.parse({
  id: "ar_acme_p1",
  goalId: "deal_acme",
  parentRunId: null,
  runKind: "first_pass",
  resolvedContext: {
    dealId: "deal_acme",
    passNumber: 1,
    capturedAt: "2026-06-27T09:55:00.000Z",
  },
  status: "complete",
  createdAt: "2026-06-27T09:55:00.000Z",
  completedAt: "2026-06-27T10:00:00.000Z",
});

/** Pass 2 run: after enforcement. Parent = Pass 1 (linked sequence). */
export const acmeAgentRunPass2: AgentRun = agentRunContract.parse({
  id: "ar_acme_p2",
  goalId: "deal_acme",
  parentRunId: "ar_acme_p1",
  runKind: "second_pass",
  resolvedContext: {
    dealId: "deal_acme",
    passNumber: 2,
    capturedAt: "2026-06-27T10:05:00.000Z",
  },
  status: "complete",
  createdAt: "2026-06-27T10:05:00.000Z",
  completedAt: "2026-06-27T10:06:00.000Z",
});

/**
 * Replay scenario (illustrative). If the governance loop surfaces a third
 * issue, a replay run would be spawned from Pass 2. This demonstrates the
 * parentRunId chain for multi-scenario work.
 */
export const acmeAgentRunReplay: AgentRun = agentRunContract.parse({
  id: "ar_acme_replay_1",
  goalId: "deal_acme",
  parentRunId: "ar_acme_p2",
  runKind: "replay",
  resolvedContext: {
    dealId: "deal_acme",
    passNumber: 2,
    capturedAt: "2026-06-27T10:20:00.000Z",
  },
  status: "complete",
  createdAt: "2026-06-27T10:20:00.000Z",
  completedAt: "2026-06-27T10:25:00.000Z",
});

/** The full Acme agent-run sequence. */
export const acmeAgentRuns = {
  runPass1: acmeAgentRunPass1,
  runPass2: acmeAgentRunPass2,
  runReplay: acmeAgentRunReplay,
} as const;
