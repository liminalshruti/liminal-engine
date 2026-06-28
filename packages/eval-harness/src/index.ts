/**
 * Eval harness — produces the Fail → Pass table (DEMO_CONTRACT must-not-cut #6).
 * Types are the EvalResult contract. The agent implements `runEvals` over fixtures
 * (deterministic — no live calls on the spine) per the Linear P0 issues.
 */
import type { EvalResult } from "@liminal-engine/contracts";

export type EvalTable = readonly EvalResult[];

/** Pretty-printable row view for the demo eval table. */
export interface EvalRow {
  pass: number;
  criterion: string;
  result: "fail" | "pass";
}

export function toRows(table: EvalTable): EvalRow[] {
  return [...table]
    .sort((a, b) => a.passNumber - b.passNumber)
    .map((r) => ({ pass: r.passNumber, criterion: r.criterion, result: r.result }));
}

export { runEvals, type EvalReader } from "./use-cases.ts";
