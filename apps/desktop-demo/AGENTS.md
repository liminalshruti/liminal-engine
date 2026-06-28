# AGENTS.md — app/desktop-demo — Screen agents handoff

This is the contract that the 7 screen agents (LIM-1215–1221) inherit. Read this
before writing any screen. **Precedence:** `DEMO_CONTRACT.md` (14-step path) →
`specs/SPEC.md` (engine wiring) → this file (UI layer).

---

## Stack & File Layout

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** CSS (design-tokens.css canon + app.css component classes)
- **Screens directory:** `apps/desktop-demo/src/screens/`
- **Component directory:** `apps/desktop-demo/src/components/` (created by LIM-1214)

### How screens mount

The shell (`App.tsx`) has a **stepper** (left rail) and a **stage** (`<main className="stage">`).
Per-screen content mounts at the active step, keyed by `DEMO_STEPS[i]`. The shell
provides:

- Beat number, phase label, must-not-cut indicator (already visible)
- Step navigation buttons (← Back, Next →)
- Fixture summary placeholder until your screen replaces it

**You do NOT edit `App.tsx`** — it is shared/coordination-sensitive. Screen routes
are pre-registered in `steps.ts` (the beat definitions); each screen fills its own
`src/screens/<ScreenName>.tsx` stub.

---

## Shared Components (from LIM-1214)

**Import barrel:** `import { StatusBadge, EvalTable, ... } from "../components";`

### 6 components, all deterministic & fixture-backed

| Component | Props | Used for |
|-----------|-------|----------|
| **StatusBadge** | `{ status: "on-track" \| "at-risk" }` | Shows deal status visually; handles the On Track → At Risk flip (MNC#3). |
| **EvalTable** | `{ rows: EvalRow[] }` (from `toRows(evalTable)`) | Renders Fail → Pass result table. Handles MNC#7 (eval proof). |
| **LinearPayloadView** | `{ projectName, issues[], requiredOwners[] }` | Simulated Linear workstream panel. Label says "Simulated". MNC#4. |
| **BlockedActionBanner** | `{ gate: ActionGate }` | Renders blocked action + reason + unblock condition. MNC#5. |
| **TraceRow** | `{ event: AuditEvent }` | Single row in an audit trail. Renders actor (role), action, before/after, timestamp. MNC#6. |
| **Card** | `{ title?, children }` | Generic container. Consistent padding, border, background. Screens compose with this. |

All are typed directly against contract types: `GovernanceCase`, `AuditEvent`, `EvalResult`, etc.
from `@liminal-engine/contracts`.

---

## Data Flow & Wiring Pattern

### 1. **Load fixture data**

```typescript
import { acmeScenario } from "@liminal-engine/contracts/fixtures";

export function YourScreen() {
  const { agentOutputPass1, governanceCase, evalPass1, evalPass2 } = acmeScenario;
  // Now use these values directly — they are deterministic, fixture-backed.
}
```

### 2. **Pass to components**

```typescript
import { StatusBadge, Card } from "../components";

<Card title="Deal Status">
  <StatusBadge status={agentOutputPass1.reportedStatus} />
</Card>
```

For the eval table (MNC#7), build rows with `toRows` from the eval-harness:

```typescript
import { toRows } from "@liminal-engine/eval-harness";
import { EvalTable } from "../components";

const { evalPass1, evalPass2 } = acmeScenario;
<EvalTable rows={toRows([evalPass1, evalPass2])} />
```

> **Component props are FROZEN.** Screens adapt to the props below — do not
> change a component's props to fit a screen. In particular, `LinearWorkstreamPayload`
> is a `specs/SPEC.md` contract that does **not yet exist**; `LinearPayloadView` is
> intentionally typed to a local shape (`projectName` / `issues[]` / `requiredOwners[]`).
> The enforcement-panel screen (LIM-1219) must construct that data by reading the
> Acme fixture — never by inventing issue keys / titles / owners ad hoc.

### 3. **No live calls on the spine**

- ✅ Use fixture data from `acmeScenario`
- ✅ Call pure use-case functions like `runGovernanceLoop()` from `@liminal-engine/governance`
- ❌ Never call Gemini, Linear API, or LiveKit directly in the spine
- ❌ Never hardcode data—always read from fixtures or governance output

### 4. **Empty/Loading states**

Components handle empty states internally (see component implementations).
If data is absent, components render a safe fallback (e.g., `eval-table__empty-message`).
Screens do NOT need to manage loading spinners on the spine — data is synchronous.

---

## Per-screen → Component → MNC mapping

The 7 screens and their component usage:

| Beat | Screen | Step | Components | MNC | Notes |
|------|--------|------|------------|-----|-------|
| 1–2 | **Initialize** (LIM-1215) | Setup workspace + show business goal | Card | — | Setup intro, no MNC involvement. |
| 2–4 | **ContextTray** (LIM-1216) | Show Acme goal + false-green agent output | Card, StatusBadge (for display of on-track status) | MNC#1 | Agent false-green claim visible. |
| 3 | **AgentActivity** (LIM-1217) | Render the first-pass agent output summary | Card | MNC#1 | The false green "on track" displayed. |
| 4–5 | **GovernanceCase** (LIM-1218) | Surface the detected governance case (dropped EU requirement) | Card, headline from ui-components | MNC#2 | The detection: what was dropped, why it matters. |
| 6–10 | **EnforcementPanel** (LIM-1219) | Approve + Enforce CTA, status flip, Linear workstream, required owners, blocked action | StatusBadge (shows flip), LinearPayloadView, BlockedActionBanner | MNC#3, MNC#4, MNC#5 | Atomic enforce: status flip + workstream + owners + gate. |
| 11 | **AuditTrail** (LIM-1220) | Show the AuditEvent(s) recorded during enforcement | TraceRow (×N) | MNC#6 | Hash-chained audit trail, decided actor is a role. |
| 12–14 | **SecondPassEval** (LIM-1221) | Show second-pass output + eval table Fail → Pass | Card, StatusBadge, EvalTable | MNC#7 | Improved output + proof: Fail → Pass. |

---

## Locked Rules for Every Screen

1. **No persona name.** Use roles only (`VP Ops / Head of AI Transformation`,
   `the operator`, `the executive owner`) — never invent a persona name.
2. **Fixtures only on the spine.** All demo data comes from `acmeScenario` or
   `runGovernanceLoop()` — never hardcode or invent demo data.
3. **Label simulated panels.** If rendering a "simulated Linear workstream",
   label it `<span className="linear-payload__simulated-badge">Simulated</span>`.
4. **No TODOs, stubs, or placeholders** in required behavior. Build it real.
5. **Component props are stable.** Don't request new props; use what's exported
   from the barrel. If a prop doesn't exist, ask the LIM-1214 agent before the PR.
6. **Styling via class names.** Use the Liminal design tokens and the component
   classes defined in `app.css`. Never inline styles; never redefine tokens.
7. **Real logic, never mocks.** If you call `runGovernanceLoop()`, the loop
   computes real logic (real detection, real enforcement, real eval). You don't
   fake the result; you wire the real function.

---

## Golden Path: Initialize Screen Example (pseudocode)

```typescript
// apps/desktop-demo/src/screens/Initialize.tsx
import { Card } from "../components";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";

export function Initialize() {
  const { businessGoal } = acmeScenario;

  return (
    <>
      <Card title="Liminal Governance Demo Setup">
        <p>
          Workspace: Acme $1.2M expansion governance.
        </p>
        <p>
          Business Goal: <strong>{businessGoal}</strong>
        </p>
      </Card>
    </>
  );
}

export default Initialize;
```

This screen:
- ✅ Imports fixture data (`acmeScenario`)
- ✅ Uses the Card component
- ✅ No hardcoded strings except structural labels
- ✅ No persona name
- ✅ Ready to be routed by the shell (step #1, #2 in DEMO_CONTRACT)

---

## PR Checklist (for screen agents)

Before opening your PR:

- [ ] Screen fills the correct stub (`src/screens/<YourName>.tsx`)
- [ ] All required components used (check the MNC mapping above)
- [ ] All data from `acmeScenario` or governance use-case output
- [ ] No live calls (boundary lint `spine-no-live-integrations` enforces this)
- [ ] No persona names — only roles
- [ ] All props typed against contract types
- [ ] Styling via design tokens + component classes
- [ ] No TODOs, stubs, or placeholder copy
- [ ] `pnpm verify` green (typecheck, test, boundary lint)
- [ ] Run `./scripts/smoke.sh` to test the 14-step path
- [ ] PR title: `LIM-###: «screen-name» — screen for beats #N–#M`
- [ ] Fill acceptance + conformance matrices in PR template
- [ ] Comment the PR link on Linear LIM-1215/1216/…, add `agent-pr-ready`, move to In Review

---

## Questions Before You Code

1. **"Can I add a new component prop?"** → No. Components are locked for the
   seam. If data shape doesn't fit, ask the LIM-1214 agent or the night-captain.
2. **"Can I call Gemini / Linear API for demo data?"** → No. Spine is fixtures-only.
   Cut-if-risky integrations are for post-spine wiring (Wave 3).
3. **"What if my screen doesn't fit the MNC mapping?"** → Your screen MUST
   satisfy one or more MNC items. If it doesn't, re-read DEMO_CONTRACT.md
   required path and check the step/beat assignment.
4. **"How do I test locally?"** → `cd` to the worktree, `pnpm install`, `npm run dev`,
   click through the stepper. The shell routes your screen by step number.

---

## Artifact Checklist (LIM-1214 delivered)

- [x] 6 components: StatusBadge, EvalTable, LinearPayloadView, BlockedActionBanner, TraceRow, Card
- [x] Component barrel: `apps/desktop-demo/src/components/index.ts`
- [x] Component CSS: appended to `apps/desktop-demo/src/styles/app.css`
- [x] This handoff doc: `apps/desktop-demo/AGENTS.md`
- [x] Each component typed against contracts, no live calls
- [x] Reference example in this doc (Initialize pseudocode)

You have everything you need. Go build the screens.
