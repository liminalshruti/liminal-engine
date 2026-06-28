/**
 * AgentActivity screen — demo beat #3 of the locked required path (DEMO_CONTRACT.md):
 *   #3  Show the agent output — "Acme expansion appears on track" — the FALSE GREEN
 *       (must-not-cut #1).
 *
 * Fills the LIM-1226 «spine-shell-v2» stub (task LIM-1217 «screen-agent-activity»).
 *
 * This is the CLEAN base for beat #3 — the OBSERVE phase. It shows the first-pass
 * agent output exactly as the operator first sees it: a confident on-track report
 * whose claim and summary never mention the load-bearing EU data-residency
 * requirement. That requirement is SILENTLY ABSENT here by design — surfacing it now
 * would steal the later beats. The reveal that a requirement was dropped is the next
 * screen (beat #4, ContextTray — the DETECT phase, which already derives that insight
 * from `falseGreenBanner` + lists the dropped requirement), and the formal detection
 * is beat #5 (GovernanceCase). So this screen deliberately does NOT use
 * `falseGreenBanner`, flag the drop, or otherwise pre-empt those beats.
 *
 * The inline-highlighted "dropped requirement" affordance is a separate UX-depth
 * layer (LIM-1236) that augments this beat; the structure below (status + verbatim
 * claim + summary, each a `screen__fact` inside a `Card`) is intentionally shaped so
 * that layer can be added later without a rewrite. Do not add it here.
 *
 * All demo facts come ONLY from the validated Acme fixtures
 * (`@liminal-engine/contracts/fixtures`) — no live calls, no hardcoded or invented
 * data (apps/desktop-demo/AGENTS.md Locked Rules #2/#4; the fixtures are the LIM-1165
 * single source). Framing copy comes from the central demo-copy module
 * (`../lib/copy.ts`); the false green is composed inside the shared `Card` widget and
 * the reported status renders through the shared `StatusBadge` (`../components`). This
 * screen has no simulated or stubbed panel, so nothing carries a "Simulated" badge —
 * that label is reserved for the simulated Linear workstream (MNC#4, EnforcementPanel).
 */
import { Card, StatusBadge } from "../components";
import { useDemo } from "../lib/demo-context.tsx";
import { SCREEN_COPY } from "../lib/copy.ts";

/**
 * AgentActivity screen content — renders the first-pass agent output with null checks.
 * Throws if required fields are missing (caught by parent ErrorBoundary).
 */
function AgentActivityContent() {
  const demo = useDemo();
  const { agentOutputPass1, demoBeats } = demo;
  const copy = SCREEN_COPY.agentActivity;

  // Null checks for required fields
  if (!agentOutputPass1) {
    throw new Error("AgentActivity requires agentOutputPass1 but it is missing");
  }

  if (!agentOutputPass1.dealName || !agentOutputPass1.reportedStatus || !agentOutputPass1.summary) {
    throw new Error(
      `AgentActivity requires dealName, reportedStatus, summary; got ${[
        !agentOutputPass1.dealName ? "missing dealName" : "",
        !agentOutputPass1.reportedStatus ? "missing reportedStatus" : "",
        !agentOutputPass1.summary ? "missing summary" : "",
      ]
        .filter(Boolean)
        .join(", ")}`,
    );
  }

  if (!demoBeats || !demoBeats.agentClaim) {
    throw new Error("AgentActivity requires demoBeats with agentClaim but it is missing");
  }

  return (
    <section className="screen screen--agent-activity" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      <Card title={copy.title}>
        <p className="screen__fact">
          Deal under governance: {agentOutputPass1.dealName} (first-pass agent output)
        </p>
        <p className="screen__fact">
          Agent claim: <strong>{demoBeats.agentClaim}</strong>
        </p>
        <p className="screen__fact">
          Reported status: <StatusBadge status={agentOutputPass1.reportedStatus} />
        </p>
        <p className="screen__fact">{agentOutputPass1.summary}</p>
      </Card>
    </section>
  );
}

export function AgentActivity() {
  return <AgentActivityContent />;
}

export default AgentActivity;
