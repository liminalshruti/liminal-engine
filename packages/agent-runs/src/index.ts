// @liminal-engine/agent-runs — AgentRun contract and fixtures for multi-scenario work.

export {
  agentRunContract,
  agentRunStatus,
  agentRunKind,
  agentRunShape,
  resolvedContextShape,
  AGENT_RUN_SCHEMA,
  agentRunGoldenVectors,
  type AgentRun,
  type AgentRunStatus,
  type AgentRunKind,
  type ResolvedContext,
} from "./agent-run.contract.ts";

export { acmeAgentRuns, acmeAgentRunPass1, acmeAgentRunPass2, acmeAgentRunReplay } from "./fixtures.ts";
