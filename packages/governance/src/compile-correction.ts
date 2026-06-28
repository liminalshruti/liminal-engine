/**
 * compile-correction — STUB (file-zone reservation for «gov-correct», LIM).
 *
 * The "correct" phase: a pure-function correction compiler that turns a
 * CorrectionEvent into EnforcementAction[] via constrained templates + a
 * phrase→action table (compiling onto EnforcementAction.actionType, the fixed
 * enum — NOT a free-form DSL), rejecting vague corrections, with
 * preview-before-activate (specs/IDEAS.md). [DEMO_CONTRACT #5→#6]
 *
 * Intentionally unimplemented: this scaffold reserves the file + barrel export so
 * «gov-correct» FILLS it without racing on index.ts. Wire the real compiler here.
 */
import type { CorrectionEvent, EnforcementAction } from "@liminal-engine/contracts";
import type { Clock, IdGen } from "./detect-miss.ts";

export interface CompileCorrectionDeps {
  clock: Clock;
  idGen: IdGen;
}

/**
 * Compile an operator correction into the enforcement actions that realize it.
 * STUB — «gov-correct» implements the template/phrase→action compiler here.
 */
export function compileCorrection(
  _correction: CorrectionEvent,
  _deps: CompileCorrectionDeps,
): EnforcementAction[] {
  throw new Error("compileCorrection not implemented — see «gov-correct» (LIM)");
}
