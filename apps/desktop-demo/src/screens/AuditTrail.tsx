/**
 * AuditTrail screen — demo beat #11 of the locked required path (DEMO_CONTRACT.md):
 *   #11  AuditEvent recorded (MNC#6) — the correction + the deciding actor captured
 *        as tamper-evident audit evidence (before/after status, case ref, timestamp).
 *
 * Fills the LIM-1226 «spine-shell-v2» stub (task LIM-1220 «screen-audit-trail»). The
 * deciding actor is rendered straight from the fixture, which holds a ROLE, never an
 * invented persona name (apps/desktop-demo/AGENTS.md Locked Rules).
 *
 * All demo facts come ONLY from the validated Acme fixtures
 * (`@liminal-engine/contracts/fixtures`) — no live calls, no invented data
 * (fixtures-only per Decision D1-a; LIM-1245 re-points to the live audit-ledger
 * output later). Each AuditEvent renders through the shared `TraceRow` widget inside a
 * `Card`; framing copy comes from `../lib/copy.ts`.
 */
import { Card, TraceRow } from "../components";
import { useDemo } from "../lib/demo-context.tsx";
import { SCREEN_COPY } from "../lib/copy.ts";

export function AuditTrail() {
  const { auditEvent } = useDemo();
  const copy = SCREEN_COPY.auditTrail;
  // The demo records one correction event; the trail is append-only, so render as a list.
  const events = [auditEvent];

  return (
    <section className="screen screen--audit-trail" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      <Card title="Audit trail">
        {events.map((event) => (
          <TraceRow key={event.id} event={event} />
        ))}
      </Card>
    </section>
  );
}

export default AuditTrail;
