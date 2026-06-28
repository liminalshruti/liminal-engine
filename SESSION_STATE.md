# SESSION_STATE.md

Current state of the build, right now. Keep this short and true.

## As of: harness merged + LIM-1165 in progress (2026-06-27 eve)

- **Phase:** Control harness **merged to `main`** (PR #1, `3792b84`). First fixture
  issue **LIM-1165 in progress** on `feature/lim-1165-create-acme-fixture-set`
  (`b065b70`, not pushed). **No app/UI yet** (demo spine = LIM-1166/1167).
- **Harness:** pnpm/TS workspace; `packages/contracts` (7 locked primitives as
  hashed contracts + golden tests + Acme fixtures asserting every must-not-cut);
  boundary lint enforcing fixtures-on-spine; CI + hooks + PR template; AGENTS.md +
  5 agent roles; Linear packets/issues in `ops/linear/`. `pnpm verify` green (47
  tests after LIM-1165). Commits = allsmog only (hook-enforced).
- **LIM-1165:** Acme fixture set ratified — `acmeDemoBeats` (verbatim DEMO_CONTRACT
  display copy for steps 2–4) + single-source `acmeScenario` + `acme-beats.test.ts`.
  No golden changes (display copy kept out of hashed fields). Branch not yet PR'd.
- **Scaffold:** All folders + docs + `.claude` dev env + `scripts/smoke.sh` created.
- **Official repo name:** `liminal-engine`.
- **Public repo:** ✅ Created and live — `github.com/liminalshruti/liminal-engine`
  (public, MIT). Clean standalone history beginning with the hackathon.
- **License:** MIT, copyright **Shruti Rajagopal and contributors**. No
  `Liminal, Inc.` claim remains anywhere in the repo.
- **Entity status:** Liminal is **not yet incorporated**. Do not use
  `Liminal, Inc.` in repo docs, license, package metadata, or submission copy
  until incorporation is complete.
- **Collaborator:** `allsmog` (Sean) invited with **push** access (invitation
  pending acceptance).
- **Source of truth:** This standalone public `liminal-engine` repo. (It was
  split out of a private `hackathons/` monorepo at setup time; that copy is
  historical only and must not be pushed — it is not the active version control.)
- **Demo path:** Locked in `DEMO_CONTRACT.md`. Not yet implemented.
- **Persona:** Not extracted. Using generic operator language. Do not invent a name.

## Blocking / waiting

- `allsmog` collaborator invitation pending Sean's acceptance.
- Persona extraction from `liminal-prototype` pending.

## Next concrete step

Open + merge the **LIM-1165** PR (branch `feature/lim-1165-create-acme-fixture-set`;
title must carry `LIM-1165`; fill the conformance matrix). Then **LIM-1166**: decide
the demo-app UI stack (Solid / React / Vite-vanilla — human gate) and stand up the
seven-screen static clickable demo in `apps/desktop-demo/` covering the full 14-step
required path, rendering Acme fixtures from `@liminal-engine/contracts/fixtures`,
followed by **LIM-1167** (typed local state).
