/**
 * runEvals — read the eval results recorded by the governance loop and return a
 * deterministic EvalTable (the Fail → Pass proof). [DEMO_CONTRACT must-not-cut #7]
 *
 * Depends on contracts only: the store is taken structurally (an EvalReader), so
 * eval-harness needn't depend on the governance package — any EvalStore satisfies
 * it. Deterministic: sorts by passNumber (then criterion) — no clock, no I/O.
 */
import {
  evalCaseContract,
  evalResultContract,
  type AgentOutput,
  type EvalCase,
  type EvalResult,
  type GovernanceCase,
} from "@liminal-engine/contracts";
import type { EvalTable } from "./index.ts";

/** The read side of an eval store — structurally satisfied by governance's EvalStore. */
export interface EvalReader {
  byDeal(dealId: string): Promise<EvalResult[]>;
}

export interface EvalHarnessClock {
  now(): string;
}

export interface EvalHarnessIdGen {
  next(): string;
}

export interface EvalSummary {
  total: number;
  pass: number;
  fail: number;
  improved: boolean;
}

export async function runEvals(store: EvalReader, dealId: string): Promise<EvalTable> {
  const results = (await store.byDeal(dealId)).map((result) => evalResultContract.parse(result));
  return [...results].sort(
    (a, b) => a.passNumber - b.passNumber || a.criterion.localeCompare(b.criterion),
  );
}

export function generateEvalCaseFromGovernanceCase(
  governanceCase: GovernanceCase,
  deps: { clock: EvalHarnessClock; idGen: EvalHarnessIdGen },
): EvalCase {
  return evalCaseContract.parse({
    id: deps.idGen.next(),
    dealId: governanceCase.dealId,
    governanceCaseId: governanceCase.id,
    criterion: `${governanceCase.missedRequirement} requirement honored`,
    createdAt: deps.clock.now(),
  });
}

export function gradeRequirementCoverage(
  evalCase: EvalCase,
  outputs: readonly AgentOutput[],
  requirementText: string,
  idForResult: (output: AgentOutput) => string = (output) => `${evalCase.id}_pass_${output.passNumber}`,
): EvalResult[] {
  const requirementTokens = tokenize(requirementText);

  return [...outputs]
    .sort((a, b) => a.passNumber - b.passNumber)
    .map((output) => {
      const outputTokens = tokenize(`${output.summary} ${output.reportedStatus}`);
      const explicitlyDropped = output.droppedRequirements.some((dropped) =>
        tokenOverlap(tokenize(dropped), requirementTokens) >= 0.5,
      );
      const covered = tokenOverlap(requirementTokens, outputTokens) >= 0.35;

      return evalResultContract.parse({
        id: idForResult(output),
        dealId: output.dealId,
        evalCaseId: evalCase.id,
        passNumber: output.passNumber,
        criterion: evalCase.criterion,
        result: !explicitlyDropped && covered ? "pass" : "fail",
      });
    });
}

export function summarizeEvalTable(table: EvalTable): EvalSummary {
  const ordered = [...table].sort(
    (a, b) => a.criterion.localeCompare(b.criterion) || a.passNumber - b.passNumber,
  );
  const pass = ordered.filter((result) => result.result === "pass").length;
  const fail = ordered.filter((result) => result.result === "fail").length;
  const byCriterion = new Map<string, EvalResult[]>();
  for (const result of ordered) {
    byCriterion.set(result.criterion, [...(byCriterion.get(result.criterion) ?? []), result]);
  }
  const improved = [...byCriterion.values()].some((results) => {
    const sorted = [...results].sort((a, b) => a.passNumber - b.passNumber);
    return sorted[0]?.result === "fail" && sorted[sorted.length - 1]?.result === "pass";
  });

  return {
    total: ordered.length,
    pass,
    fail,
    improved,
  };
}

const STOP_WORDS = new Set([
  "a",
  "all",
  "an",
  "and",
  "are",
  "as",
  "be",
  "before",
  "for",
  "honored",
  "in",
  "is",
  "must",
  "of",
  "on",
  "or",
  "requirement",
  "shall",
  "the",
  "to",
  "with",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function tokenOverlap(needle: ReadonlySet<string>, haystack: ReadonlySet<string>): number {
  if (needle.size === 0) return 1;
  let hits = 0;
  for (const token of needle) {
    if (haystack.has(token)) hits += 1;
  }
  return hits / needle.size;
}
