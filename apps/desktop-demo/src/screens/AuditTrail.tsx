/**
 * AuditTrail screen — beat #11 · MNC#6 (AuditEvent recorded).
 * STUB created by LIM-1226 «spine-shell-v2». Filled by LIM-1220 «screen-audit-trail».
 *
 * Renders the AuditEvent(s) recorded on enforce — the correction + the deciding actor
 * (a ROLE) as audit evidence. Use TraceRow (../components) per audit event.
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { SCREEN_COPY } from "../lib/copy.ts";

export function AuditTrail() {
  const { auditEvent } = acmeScenario;
  const copy = SCREEN_COPY.auditTrail;

  return (
    <section className="screen screen--audit-trail" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <p className="screen__fact">
        AuditEvent {auditEvent.id}: {auditEvent.action} — deciding actor{" "}
        <strong>{auditEvent.decidingActor}</strong>.
      </p>
      <p className="screen__stub-note">Stub — to be filled by LIM-1220 (MNC#6).</p>
    </section>
  );
}

export default AuditTrail;
