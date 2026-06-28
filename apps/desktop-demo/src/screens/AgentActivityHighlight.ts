import type { AgentOutput, GovernanceCase } from "@liminal-engine/contracts";

export interface InlineHighlightSegment {
  readonly text: string;
  readonly highlight: boolean;
}

export function droppedRequirementForHighlight(
  output: AgentOutput,
  governanceCase: GovernanceCase,
): string {
  const requirement = governanceCase.missedRequirement;

  if (!output.droppedRequirements.includes(requirement)) {
    throw new Error(
      `governance case ${governanceCase.id} must match a dropped requirement on ${output.id}`,
    );
  }

  return requirement;
}

export function sourceCallRequirementLine(dealName: string, requirement: string): string {
  if (dealName.length === 0) {
    throw new Error("dealName is required for dropped-requirement source copy");
  }
  if (requirement.length === 0) {
    throw new Error("requirement is required for dropped-requirement source copy");
  }

  return `${dealName} customer call: preserve ${requirement} before expansion approval.`;
}

export function splitInlineHighlight(
  sourceText: string,
  exactPhrase: string,
): readonly InlineHighlightSegment[] {
  if (sourceText.length === 0) {
    throw new Error("sourceText is required for inline highlighting");
  }
  if (exactPhrase.length === 0) {
    throw new Error("exactPhrase is required for inline highlighting");
  }

  const start = sourceText.indexOf(exactPhrase);
  if (start === -1) {
    throw new Error(`"${exactPhrase}" was not found in source text`);
  }

  const before = sourceText.slice(0, start);
  const after = sourceText.slice(start + exactPhrase.length);

  return [
    before.length > 0 ? { text: before, highlight: false } : undefined,
    { text: exactPhrase, highlight: true },
    after.length > 0 ? { text: after, highlight: false } : undefined,
  ].filter((segment): segment is InlineHighlightSegment => segment !== undefined);
}
