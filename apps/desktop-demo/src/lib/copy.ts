/**
 * Central demo-copy module (LIM-1226 «spine-shell-v2»).
 *
 * The single source for presentation strings the screens render. Facts (the goal,
 * the dropped requirement, statuses) live in the validated Acme fixtures
 * (`@liminal-engine/contracts/fixtures`); this module holds only generic framing
 * copy — labels, screen intros, operator-role language.
 *
 * Persona rule (CLAUDE.md / DEMO_CONTRACT): refer to the demo user only by ROLE,
 * never an invented name.
 *
 * Register (LIM-1247): the demo's daily-operator persona is distinct from
 * liminal-prototype's investor/evaluator persona (PRODUCT.md is explicit: that
 * surface is "evaluative, not operational"). So we do NOT import a name or that
 * persona — we lift only the canonical REGISTER, marked ADAPTED FROM below:
 *   // ADAPTED FROM: liminal-prototype/PRODUCT.md "Brand Personality" — bounded,
 *   //   forensic, inevitable; "judgment infrastructure" framing. Register only.
 * Forensic = evidence over assertion. Bounded = the system refuses, visibly.
 * Inevitable = calm, declarative, already-true. Role stays generic.
 */

/** Operator role label — role only, never an invented name (CLAUDE.md lock). */
export const OPERATOR_ROLE = "VP Ops / Head of AI Transformation";

/** Per-screen framing copy (titles + one-line intros). Facts come from fixtures. */
export const SCREEN_COPY = {
  initialize: {
    title: "Initialize governance workspace",
    intro: "Judgment infrastructure for agentic work. Liminal Engine watches the Acme expansion and the agents running it.",
  },
  agentActivity: {
    title: "Agent output",
    intro: "What the agents reported on the deal — the on-track claim, as the operator first sees it.",
  },
  contextTray: {
    title: "Context",
    intro: "The source material the agents worked from — provenance for where the requirement lived.",
  },
  governanceCase: {
    title: "Governance case",
    intro: "A load-bearing customer requirement was silently dropped. Liminal surfaces it with evidence, not assertion.",
  },
  enforcementPanel: {
    title: "Approve + Enforce",
    intro: "The operator approves; the correction becomes enforceable operating state, and the downstream action is bounded until it holds.",
  },
  auditTrail: {
    title: "Audit trail",
    intro: "The correction and the deciding actor, recorded as tamper-evident audit evidence.",
  },
  secondPassEval: {
    title: "Second pass + eval",
    intro: "The agents re-run under enforcement; the eval proves the next pass improved — Fail → Pass.",
  },
} as const;

export type ScreenKey = keyof typeof SCREEN_COPY;
