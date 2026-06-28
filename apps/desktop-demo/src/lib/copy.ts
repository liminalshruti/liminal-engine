/**
 * Central demo-copy module (LIM-1226 «spine-shell-v2»).
 *
 * The single source for presentation strings the screens render. Facts (the goal,
 * the dropped requirement, statuses) live in the validated Acme fixtures
 * (`@liminal-engine/contracts/fixtures`); this module holds only generic framing
 * copy — labels, screen intros, operator-role language.
 *
 * Persona rule (CLAUDE.md / DEMO_CONTRACT): refer to the demo user only by ROLE,
 * never an invented name. The «persona» task (LIM-1190) replaces these strings with
 * persona-accurate copy once a role/persona is extracted from `liminal-prototype`.
 */

/** Operator role label — generic until persona extraction. Never an invented name. */
export const OPERATOR_ROLE = "VP Ops / Head of AI Transformation";

/** Per-screen framing copy (titles + one-line intros). Facts come from fixtures. */
export const SCREEN_COPY = {
  initialize: {
    title: "Initialize governance workspace",
    intro: "Liminal Engine observes the Acme expansion and the agents working it.",
  },
  agentActivity: {
    title: "Agent output",
    intro: "What the AI agents reported on the deal — as the operator first sees it.",
  },
  contextTray: {
    title: "Context",
    intro: "The source material the agents worked from — where the requirement lived.",
  },
  governanceCase: {
    title: "Governance case",
    intro: "Liminal detects a load-bearing customer requirement was silently dropped.",
  },
  enforcementPanel: {
    title: "Approve + Enforce",
    intro: `The ${"operator"} approves the correction; it becomes enforceable operating state.`,
  },
  auditTrail: {
    title: "Audit trail",
    intro: "The correction and the deciding actor, recorded as audit evidence.",
    dataResidencyNote:
      "Sensitive customer data is recorded in the audit ledger by reference (canonical-hash), never stored raw — so the trail can be replicated across regions without moving EU-personal data.",
  },
  secondPassEval: {
    title: "Second pass + eval",
    intro: "The agents re-run under enforcement; the eval proves the next pass improved.",
  },
} as const;

export type ScreenKey = keyof typeof SCREEN_COPY;
