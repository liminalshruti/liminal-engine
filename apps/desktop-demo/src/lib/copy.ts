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
    title: "The deal: $1.2M Acme expansion",
    intro: "A company resourced AI agents to close this contract. Liminal watches the deal and the agents running it.",
  },
  agentActivity: {
    title: "Agent output: Appears on track",
    intro: "The agents say the deal is green. This is what the operator sees first — and it's wrong.",
  },
  contextTray: {
    title: "What was actually required",
    intro: "The customer's demand: EU data residency. The agents had this context. It's missing from the output.",
  },
  governanceCase: {
    title: "Liminal flags the drift",
    intro: "Liminal caught it: a load-bearing requirement was silently dropped. The deal is actually at risk.",
  },
  enforcementPanel: {
    title: "The operator approves correction",
    intro: "One decision: enforce the requirement. The system blocks the false 'on track' message until it's fixed.",
  },
  auditTrail: {
    title: "Tamper-evident record",
    intro: "Who decided what, when, and why — sealed in audit. EU data-residency requirements can't be stored raw, so we record by reference only.",
    dataResidencyNote:
      "Sensitive customer data is recorded in the audit ledger by reference (canonical-hash), never stored raw — so the trail can be replicated across regions without moving EU-personal data.",
  },
  secondPassEval: {
    title: "Second pass: Agents improve",
    intro: "The agents run again with the requirement enforced. Eval shows they fixed it: Fail → Pass.",
  },
} as const;

export type ScreenKey = keyof typeof SCREEN_COPY;
