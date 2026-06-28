# UI Workbench Spec — Liminal Engine as the governance register of the Liminal desktop app

> Target: Liminal Engine should read as **the Business / institutional-governance slate
> of the SAME desktop app** as `liminal-prototype` Cut 01 — not a separate hackathon
> dashboard. Adopt the shared shell GRAMMAR (frame, titlebar, phase row, three-pane
> workbench, slate, agency rail, tray, frame receipt), rebuilt fresh against our tokens.
>
> Provenance rule: LEARN the grammar from Cut 01; write NEW CSS/JSX. Where any block is
> closely adapted, mark `// ADAPTED FROM: liminal-prototype/lib/cut-shell.css — prior work`.
> This keeps it honestly hack-built (hack DQ rule: identify contributions).

## Source grammar (extracted from real Cut-01 source)
- DOM: `frame → titlebar → product-row → (rail-left + slate-area + rail-right) → tray-pop`,
  loudest object = `.slate-title`. (`cuts/01-slate-tray.html` L771–1045)
- `.frame`: `var(--frame-bg)` · 1px `var(--frame-border)` · radius 14px · `box-shadow: 0 40px 80px var(--scrim-modal), 0 0 0 1px var(--hover) inset` · min-height ~920px.
- `.titlebar`: 44px · `grid auto 1fr auto` · traffic lights (`--alarm-600`/`--amber-orn-500`/`--connection-600`) · centered title-row w/ `--display` diamond · right pill.
- `.main`: `grid-template-columns: 280px 1fr 320px`.
- `.rail-left`: `--frame-bg-2`, right border. `.slate-title`: `var(--display)` 28px, `-0.02em`. `.slate-subtitle`: `var(--serif)` italic.
- Staged boot motion: `body[data-boot="staged"]` reveals frame→titlebar→row→rails→tray in sequence.

## Token mapping (ALL verified present in our design-tokens.css, except as noted)
| Cut-01 shell token | Use in Liminal Engine | Status |
|---|---|---|
| `--frame-bg`, `--frame-bg-2`, `--frame-border` | frame + rails | ✅ exists |
| `--scrim-modal`, `--hover` | frame shadow/inset | ✅ |
| `--display`, `--serif` | slate-title / subtitle | ✅ |
| `--text`, `--text-dim`, `--text-mid`, `--text-faint` | telemetry hierarchy | ✅ |
| `--alarm-600` / `--amber-orn-500` / `--connection-600` | traffic lights | ✅ |
| **`--p-accent`** (Cut-01 per-mode accent) | **bind governance register to `--outreach` / `--outreach-glow`** (enforce=institutional) | ⚠️ `--p-accent` absent — use `--outreach` |
| phase registers | observe→`--diligence`/`--clarity`, detect→`--judgment`, enforce→`--outreach`, audit→`--synthesis`, improve→`--agency` | ✅ all exist |
| eval pass/fail | `--demo-pass-bg` / `--demo-fail-bg` | ✅ |

## The layout to build (per the founder's ASCII)
```
┌──────────────────────────────────────────────────────────────────────┐
│ ● ● ●   ◇ Liminal Engine · corrections become control   audit chain ✓ │  titlebar
├──────────────────────────────────────────────────────────────────────┤
│ observe   detect   enforce   audit   improve            Acme · $1.2M  │  phase row
├───────────────────┬──────────────────────────────┬───────────────────┤
│ CASE RAIL (280)   │ CASE SLATE (1fr)             │ GOVERNANCE RAIL    │
│ 01 False green    │  SEVERITY · BLOCKING         │  GTM      ◉ read   │  agency rail (320)
│ 02 Lost req       │  False green detected        │  Product  ⊘ missed │
│ 03 GovernanceCase │  EU data residency dropped…  │  Security ● req    │
│ 04 Enforce        │  [evidence canvas]           │  Gate     DENY     │
│ 05 Blocked        │  [Approve + Enforce]         │  Eval     PASS     │
│ 06 AuditEvent     │                              │  ↓ arch flow       │
│ 07 EvalCase       │                              │                    │
├───────────────────┴──────────────────────────────┴───────────────────┤
│ ◇ chain verified · gc_acme_eu · ea_001 · ae_001 · ec_001 · gate denied │  frame receipt
└──────────────────────────────────────────────────────────────────────┘
                                                              tray pill →
```

## Region jurisdiction (the load-bearing principle: every region has a job)
- **titlebar** — mission line `◇ Liminal Engine · agentic work governance · corrections become control` + right pill `◇ case gc_acme_eu · chain verified`. Operator chrome, NOT a marketing header.
- **phase row** — observe·detect·enforce·audit·improve, each register-accented; current phase dominant. (Replaces the wizard-stepper framing; the 14 beats still drive it.)
- **rail-left = case timeline** — case progression (False green → Lost req → GovernanceCase → Enforce → Blocked → AuditEvent → EvalCase), active row left-accent + sealed-completed styling.
- **slate (center) = current governance artifact** — classification/severity strip → `.slate-title` hero (e.g. "False green detected", NOT "Beat 5/14") → evidence canvas → decision/artifact → inline audit ribbon.
- **rail-right = agency/gate/eval architecture** — the Acme agent system w/ states (◉read ⊘missed ●required ◯pending DENY PASS) + the visible flow output→case→enforce→gate→audit→eval. "The diagram IS the architecture."
- **tray = evidence substrate** — right-attached drawer: call · proposal · launch plan · agent trace · Linear workstream · eval result. A source drawer, not another sidebar.
- **frame receipt (bottom) = chain/audit/eval memory** — persistent one-liner. Audit is never hidden in a screen.

## Signed-artifact treatment (Cut-01 disposition → our EnforcementAction/AuditEvent/EvalCase)
EnforcementAction after Approve+Enforce should render like Cut-01's signed bone-paper
disposition: classification stripe, "ENFORCED" stamp, On Track → At Risk, applied-by ROLE
(no invented name), the applied actions checklist, SHA-256-style receipt id. Audit + eval
should likewise feel sealed/generated, not like table rows.

## Motion = state only (no decoration)
case opened · status flip (On Track→At Risk slide/fade) · gate clamps shut · audit seals with hash · eval row flips Fail→Pass · evidence settles into slate. Subtle + fast (≤3-min demo).

## Hard constraints (same as the polish pass)
- No changes to engine, fixtures, contracts, API, governance/eval logic, DEMO_STEPS, or copy meaning. Keep all 14 beats + 7 MNC visible.
- Do NOT edit design-tokens.css. No new dependencies. Preserve a11y (focus, labels, contrast).
- This is a STRUCTURAL pass → it MAY edit App.tsx + screen JSX layout (unlike the CSS-only polish pass). Keep data bindings intact.
- Verify: typecheck:app + build + `pnpm verify` + `node tools/check-spine-guard.mjs` all green.

## Sequencing
Dispatch ONLY after the CSS-polish pass (agent afd0…, branch agent/LIM-UI-POLISH-prototype-cuts) lands, on a fresh branch off that result (or off main if polish is dropped). Queued PR, never auto-merge.
