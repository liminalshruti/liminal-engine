import type {
  AgentOutput,
  GovernanceCase,
  LinearWorkstreamPayload,
} from "@liminal-engine/contracts";

export interface AgentActivityTraceInput {
  readonly businessGoal: string;
  readonly agentOutputPass1: AgentOutput;
  readonly governanceCase: GovernanceCase;
  readonly linearWorkstreamPayload: LinearWorkstreamPayload;
}

export interface TraceArtifact {
  readonly label: string;
  readonly value: string;
  readonly state: "used" | "missing";
}

export interface AgentTraceCard {
  readonly id: string;
  readonly agentRole: string;
  readonly traceSummary: string;
  readonly artifacts: readonly TraceArtifact[];
  readonly missingRequirementLine?: string;
  readonly tone: "used" | "missing";
}

export interface MissingRequirementEvidenceLine {
  readonly requirement: string;
  readonly sourceArtifact: string;
  readonly downstreamArtifact: string;
  readonly line: string;
}

export interface AgentActivityTrace {
  readonly cards: readonly AgentTraceCard[];
  readonly missingRequirementEvidenceLine: MissingRequirementEvidenceLine;
  readonly falseGreenLine: string;
}

const DOWNSTREAM_ARTIFACT = "first-pass agent output";

export function buildAgentActivityTrace(input: AgentActivityTraceInput): AgentActivityTrace {
  const requirement = droppedRequirementForTrace(
    input.agentOutputPass1,
    input.governanceCase,
  );
  const evidenceLine = missingRequirementEvidenceLine(input.agentOutputPass1, requirement);
  const cards = input.linearWorkstreamPayload.requiredOwners.map((owner) =>
    traceCardForOwner(owner, input, requirement, evidenceLine),
  );

  return {
    cards,
    missingRequirementEvidenceLine: evidenceLine,
    falseGreenLine: `${input.agentOutputPass1.dealName} pass ${input.agentOutputPass1.passNumber} reported ${input.agentOutputPass1.reportedStatus} while dropping ${requirement}.`,
  };
}

export function droppedRequirementForTrace(
  output: AgentOutput,
  governanceCase: GovernanceCase,
): string {
  if (output.dealId !== governanceCase.dealId) {
    throw new Error(
      `agent output ${output.id} and governance case ${governanceCase.id} must reference the same deal`,
    );
  }

  const requirement = governanceCase.missedRequirement;
  if (!output.droppedRequirements.includes(requirement)) {
    throw new Error(
      `governance case ${governanceCase.id} must match a dropped requirement on ${output.id}`,
    );
  }

  return requirement;
}

function traceCardForOwner(
  owner: string,
  input: AgentActivityTraceInput,
  requirement: string,
  evidenceLine: MissingRequirementEvidenceLine,
): AgentTraceCard {
  const workstream = input.linearWorkstreamPayload.workstreams.find(
    (candidate) => candidate.owner === owner,
  );
  if (!workstream) {
    throw new Error(`required owner ${owner} has no workstream artifact`);
  }

  const coversRequirement = workstreamCoversRequirement(workstream.title, requirement);
  const artifacts: TraceArtifact[] = [
    { label: "Goal artifact", value: input.businessGoal, state: "used" },
    { label: "Workstream artifact", value: workstream.title, state: "used" },
  ];

  if (coversRequirement) {
    artifacts.push({ label: "Dropped requirement", value: requirement, state: "missing" });
  }

  return {
    id: `${owner.toLowerCase()}-${workstream.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    agentRole: `${owner} agent`,
    traceSummary: coversRequirement
      ? `${owner} trace carried ${requirement}, but the pass-1 output still reported all workstreams green.`
      : `${owner} trace rolled up ${workstream.title} into the pass-1 on-track report.`,
    artifacts,
    ...(coversRequirement ? { missingRequirementLine: evidenceLine.line } : {}),
    tone: coversRequirement ? "missing" : "used",
  };
}

function missingRequirementEvidenceLine(
  output: AgentOutput,
  requirement: string,
): MissingRequirementEvidenceLine {
  const sourceArtifact = `${output.dealName} customer call`;

  return {
    requirement,
    sourceArtifact,
    downstreamArtifact: DOWNSTREAM_ARTIFACT,
    line: `${requirement} was present in ${sourceArtifact} but missing from ${DOWNSTREAM_ARTIFACT}: "${output.summary}"`,
  };
}

function workstreamCoversRequirement(workstreamTitle: string, requirement: string): boolean {
  const title = normalizeTokens(workstreamTitle);
  const requirementTokens = normalizeTokens(requirement).filter((token) => token.length > 2);

  return requirementTokens.some((token) => title.includes(token));
}

function normalizeTokens(value: string): readonly string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}
