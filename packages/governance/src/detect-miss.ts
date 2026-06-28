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

/**
 * Optional evidence the composition root attaches to a detected case (LIM-1254).
 * The dropped requirement alone doesn't carry business impact / where it went
 * missing / recommended enforcement — that's scenario knowledge, INJECTED here so
 * the generic detector stays free of demo-specific copy. When supplied, the loop
 * genuinely PRODUCES the enriched case (it's not a fixture passthrough), so the
 * GovernanceCase screen's evidence sections render real engine output.
 */
export interface CaseEvidence {
  businessImpact?: string;
  missingFrom?: string[];
  recommendedActions?: string[];
}

export async function detectMiss(
  source: AgentOutputSource,
  caseStore: GovernanceCaseStore,
  dealId: string,
  passNumber: number,
  clock: Clock,
  idGen: IdGen,
  evidence?: CaseEvidence,
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
    // Spread only the keys that were provided — absent evidence leaves the case
    // minimal (and its canonical hash unchanged), matching the contract's
    // "optional ⇒ absent ⇒ hash unchanged" rule.
    ...(evidence?.businessImpact !== undefined ? { businessImpact: evidence.businessImpact } : {}),
    ...(evidence?.missingFrom !== undefined ? { missingFrom: evidence.missingFrom } : {}),
    ...(evidence?.recommendedActions !== undefined
      ? { recommendedActions: evidence.recommendedActions }
      : {}),
  };
  await caseStore.open(governanceCase);
  return governanceCase;
}
