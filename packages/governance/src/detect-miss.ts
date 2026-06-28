/**
 * detect — the "detect" phase of the loop. Reads a pass of agent output; if it
 * silently dropped a requirement, opens a blocking GovernanceCase. [must-not-cut #2]
 *
 * Also the canonical home for the injected determinism types (Clock / IdGen) the
 * other governance modules share — IDs + timestamps are INJECTED, never Date.now()
 * / Math.random() (the demo spine reproduces the locked Acme fixture values).
 *
 * «gov-detect» (LIM) deepens the detector taxonomy here (conflict-with-prior-
 * correction, missingFrom[], explicit case-open threshold).
 */
import type { GovernanceCase } from "@liminal-engine/contracts";
import type { AgentOutputSource, GovernanceCaseStore } from "./ports.ts";

/** Deterministic sources of identity + time, injected at the composition root. */
export interface Clock {
  now(): string;
}
export interface IdGen {
  next(): string;
}

export async function detectMiss(
  source: AgentOutputSource,
  caseStore: GovernanceCaseStore,
  dealId: string,
  passNumber: number,
  clock: Clock,
  idGen: IdGen,
): Promise<GovernanceCase | null> {
  const output = await source.getOutput(dealId, passNumber);
  const missed = output.droppedRequirements[0];
  if (!missed) return null;

  const governanceCase: GovernanceCase = {
    id: idGen.next(),
    dealId,
    missedRequirement: missed,
    category: "data-governance",
    severity: "blocking",
    status: "open",
    detectedAt: clock.now(),
  };
  await caseStore.open(governanceCase);
  return governanceCase;
}
