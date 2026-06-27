# SESSION_STATE.md

Current state of the build, right now. Keep this short and true.

## As of: control-harness session (2026-06-27)

- **Phase:** Control harness in place + verified, reconciled to the 14-step / 7
  must-not-cut demo contract. **No app/UI yet** (still LE-1).
- **Harness:** pnpm/TS workspace; `packages/contracts` (7 locked primitives as
  hashed contracts + golden tests + Acme fixtures asserting every must-not-cut);
  boundary lint enforcing fixtures-on-spine; CI + hooks + PR template; AGENTS.md +
  5 agent roles; Linear packets/issues in `ops/linear/`. `pnpm verify` green (43
  tests). Commits = allsmog only (hook-enforced). **Local only — not pushed.**
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

Decide the demo-app UI stack (LE-1), then stand up the static clickable demo in
`apps/desktop-demo/` covering the full 14-step required demo path, rendering the
deterministic Acme fixtures from `@liminal-engine/contracts/fixtures`.
