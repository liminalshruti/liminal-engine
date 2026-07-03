# iMac productivity loops — Liminal Engine hack   (origin/main @ fb2f607)
# 3 loops, paste each into a SEPARATE Claude Code session on the iMac, in ~/liminal/liminal-engine.
# All ACT on Linear live + report. Lane split: iMac = Shruti (engine + submission). Sean's machines = screens.
#
# MILESTONE MAP (path to done), verified against the board:
#   M0 Brief ✅ done. M1 Spine: 6 screen-* (SEAN) + gov-scaffold (SHRUTI) + contracts-policy + harness-lock.
#   M2 Build: proof/trust mechanism, visible-provenance, smoke checklist.
#   M3 Proof: fallback demo path (Sean). M4 Submission (SHRUTI): claim-scan, IP receipt, demo backup, demo-lock.
#   ~22 milestone-LESS fan-out tasks (gov-correct, audit-ledger, depth, Demo-UX, e2e/determinism tests) — drive via L2/groom via L3.
#
# ⚠️ ROOT CAUSE still live: «gov-scaffold» (LIM-1225) NEVER LANDED → gov-* PRs race on governance/src/index.ts.
#    Every gov collision today (#14/#18/#19) is this. L2 builds it FIRST. Until then, expect index.ts conflicts.
#
# Screens (6 screen-* + wire-to-loop) are SEAN's lane — NOT driven here (he's running them). L3 flags if they stall.

──────────────────────────────────────────────────────────────────────
LOOP 1 — PR babysitter (5 min). Merge train. Milestone-agnostic.
──────────────────────────────────────────────────────────────────────
/loop 5m Babysit open PRs on liminalshruti/liminal-engine. For each: check CI + mergeability + reviewDecision.
- APPROVED + green + mergeable → merge (gh pr merge --merge --delete-branch); set its Linear issue Done.
- CONFLICTING → comment a "merge main / rebase" plan on the issue; label needs-rebase.
- CI failing → summarize the failing check on the issue; label ci-red.
- green + mergeable but UNREVIEWED → list as "ready, awaiting review" (do NOT self-merge others' PRs).
After ANY merge: pull main, run `pnpm verify` + `cd apps/desktop-demo && pnpm typecheck`; if red, STOP + alert.
Report ONLY changes since last pass.

──────────────────────────────────────────────────────────────────────
LOOP 2 — Shruti critical-path driver (self-paced). Engine → submission. Self-merges own green PRs.
──────────────────────────────────────────────────────────────────────
/loop Drive my (Shruti) chain to DONE, in this milestone order on liminal-engine. ONE issue per iteration, then report.
Each: `pnpm wt:new` off FRESH main (NEVER the shared main checkout); build to specs/SPEC.md; `pnpm verify` green +
app `.tsx` typecheck; PR w/ conformance matrix; self-merge ONLY if CI-green AND mergeable AND touches only its files.
  1. «gov-scaffold» (LIM-1225) — FIRST, the root unblock. Decompose use-cases.ts → 6 files
     (detect-miss/enforce/proxy-gate/second-pass/compile-correction/audit-ledger) + ports + barrel, on v2 ActionGate.
  2. «gov-correct» (CorrectionEvent → EnforcementAction compiler) — fills its stub.
  3. Reconcile audit-ledger if #19 left gaps; gov-detect-depth, eval-depth (fan-out engine).
  4. M2: "Add proof / eval / trust mechanism", "Map each demo step to proof surface", "Define eval criteria".
  5. M4 SUBMISSION GATES — build the mechanical part, then STOP + hand to Shruti (founder/judgment calls):
     claim-scan/truth-audit, IP receipt update, record demo backup, demo-lock readiness.
STOP + escalate if verify fails, a merge conflicts, or the task needs a founder decision (M4 gates).

──────────────────────────────────────────────────────────────────────
LOOP 3 — board groomer + coverage watch + handoff (15 min).
──────────────────────────────────────────────────────────────────────
/loop 15m Groom Linear "Hackathon Execution". Reconcile every In Progress/In Review/Todo vs its PR's real state;
drop stale labels (agent-pr-ready/ci-red/blocked on PRs that moved). Flag assignee/owner mismatches + any session
working in the shared main checkout (uncommitted files in main = anti-pattern). Clean merged worktrees (`pnpm wt:rm`).
COVERAGE WATCH: per milestone, report any lane with Todo work but NO active driver (esp. the 6 screen-* — if Sean's
not progressing them, flag it). Note milestone-LESS issues so they don't rot. Emit a "READY FOR MAC MINI" list:
unblocked + parallel-ready Backlog with file zones. Act live. Report ONLY drift + coverage gaps.
