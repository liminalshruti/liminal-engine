# Merge Integration Report — the REAL state of the KEEP stack

> Depth finding (2026-06-28): I actually attempted to merge the 14 convergence-KEEP
> PRs together in a throwaway integration branch + ran the result. The verify-only
> loops never did this — they checked each PR against main in ISOLATION. Stacked,
> **8 of 14 KEEP PRs conflict with each other.** This corrects the convergence loop's
> "~90 min clean merge, no blocking risks" — the merge is NOT clean.

## What actually happened (throwaway integration off main cb1102e)

**Merged CLEAN (6):** #72 (shell), #69 (Initialize), #68 (AgentActivity), #71 (ContextTray),
#62 (error-hardening), #66 (live-wire dataResidencyRef). This 6-PR stack **builds +
`pnpm verify` green (137 tests) + app builds**. Spine intact.

**CONFLICT when stacked (8):** #70, #73, #61, #76, #78, #65, #64, #63.

## The conflict map (root cause: many PRs append to the same shared files)

| Conflicting PR | Collides on | Nature |
|---|---|---|
| #70 governancecase-polish | `styles/app.css` | append-conflict (style block) |
| #73 (UX wf) | `styles/app.css` | append-conflict |
| #61 design-tokens | `styles/app.css` | append-conflict |
| #78 secondpasseval-polish | `styles/app.css` | append-conflict |
| #76 audittrail-polish | `styles/app.css` + `screens/AuditTrail.tsx` | append + screen overlap |
| #65 audit-redaction-ui | `components/index.tsx` + `screens/AuditTrail.tsx` | barrel + screen overlap |
| #64 correction-template-ui | `components/index.tsx` + `main.tsx` + `screens/GovernanceCase.tsx` | barrel + screen overlap |
| #63 case-detail-layout | `components/index.tsx` + `screens/GovernanceCase.tsx` | barrel + screen overlap |

**4 hot files:** `app.css` (5 PRs), `components/index.tsx` barrel (3), `AuditTrail.tsx` (2),
`GovernanceCase.tsx` (2), `main.tsx` (1). All MECHANICAL append-conflicts, not logic
disagreements — resolvable, just not auto-mergeable.

## Recommended morning merge sequence (conflict-aware, NOT the naive order)

1. **Merge the clean 6 first** (no conflicts): #72 → #69 → #68 → #71 → #62 → #66.
   After this, main is submission-grade-shell + 3 polished screens + hardening + full live-wire.
2. **Then the app.css cluster, one at a time, re-merging main between each** so each
   rebases onto the prior's app.css additions: #61 (tokens) → #70 → #73 → #78. Each is a
   ~2-min manual "keep both blocks" resolution.
3. **Then the AuditTrail pair in order:** #65 (redaction, adds barrel export + screen) →
   #76 (audittrail polish) — #76 rebases onto #65's AuditTrail.tsx. **#76 also needs its
   hardcoded-rgba()-colors tokenized first** (flagged by the UX cohesion audit).
4. **Then the GovernanceCase pair:** #63 (layout) → #64 (correction templates) — second
   one rebases onto the first's GovernanceCase.tsx + barrel.
5. `pnpm verify` after each cluster; spine-guard (CI) will catch any MNC/e2e regression.

## Honest takeaways
- The naive "merge 14 in convergence order" hits 8 conflicts. Use the cluster order above.
- The conflicts are cheap to resolve (append "keep both") but must be done by a human or
  a careful agent — they're real merge conflicts, not noise.
- **Better fix for next time:** polish PRs that all edit `app.css` + the barrel should be
  serialized (rebased on each other) at BUILD time, not merge time. The isolated-worktree
  model that prevents *build* collisions guarantees *merge* collisions on shared files.
- Visual/pixel verification was BLOCKED this session (chrome-devtools profile locked by
  another session; no headless bin) — the demo serves + renders (DOM verified, title
  correct) but no screenshots were captured. Recommend a visual pass on return.
