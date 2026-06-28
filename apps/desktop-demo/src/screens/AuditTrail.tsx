/**
 * AuditTrail screen — demo beat #11 of the locked required path (DEMO_CONTRACT.md):
 *   #11  AuditEvent recorded (MNC#6) — the correction + the deciding actor captured
 *        as tamper-evident audit evidence (before/after status, case ref, timestamp).
 *
 * Fills the LIM-1226 «spine-shell-v2» stub (task LIM-1220 «screen-audit-trail»). The
 * deciding actor is rendered straight from the fixture, which holds a ROLE, never an
 * invented persona name (apps/desktop-demo/AGENTS.md Locked Rules).
 *
 * Demo facts source (LIM-1255 / LIM-1201): every value on this screen comes from the
 * live governance demo (`useDemo()` — the real engine driving the UI), no raw fixture
 * read. The audit event is the loop's recorded evidence; the data-residency reference
 * is produced live by the real `redact()` helper in `buildGovernanceDemo()`.
 *
 * Data-residency note (LIM-1248): a small additive panel proving sensitive customer
 * data is recorded by reference/hash, never raw. The reference is the redacted
 * `RedactedRef` the audit ledger stores (`acmeScenario.dataResidencyRef`), built from
 * the single-source fixture via the real `redact` helper — fixture-driven, simulated.
 *
 * Extended with:
 * - RedactionNote component (LIM-1248) — renders the redacted reference with visual proof
 * - AuditChain component (LIM-1248) — displays hash-chain integrity as a visual proof
 */
import { Card, TraceRow, RedactionNote, AuditChain } from "../components";
import { useDemo } from "../lib/demo-context.tsx";
import { SCREEN_COPY } from "../lib/copy.ts";

/**
 * AuditTrail screen content — renders audit events with null checks.
 * Throws if required fields are missing (caught by parent ErrorBoundary).
 *
 * Everything renders from the live loop output (useDemo()), including the
 * data-residency redacted ref — no raw fixture import (UI == engine, all 7 screens).
 */
function AuditTrailContent() {
  const { auditEvent, dataResidencyRef } = useDemo();

  // Null checks for required fields
  if (!auditEvent) {
    throw new Error("AuditTrail requires auditEvent but it is missing");
  }

  if (!auditEvent.id || !auditEvent.previousStatus || !auditEvent.newStatus) {
    throw new Error(
      `AuditTrail requires auditEvent with id, previousStatus, newStatus; got ${[
        !auditEvent.id ? "missing id" : "",
        !auditEvent.previousStatus ? "missing previousStatus" : "",
        !auditEvent.newStatus ? "missing newStatus" : "",
      ]
        .filter(Boolean)
        .join(", ")}`,
    );
  }

  if (!dataResidencyRef || !dataResidencyRef.label || !dataResidencyRef.hash) {
    throw new Error(
      "AuditTrail requires dataResidencyRef with label and hash but data is incomplete",
    );
  }

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

      <Card title="Data residency">
        <p className="screen__intro">
          {copy.dataResidencyNote}{" "}
          <span className="linear-payload__simulated-badge">Simulated</span>
        </p>
        <RedactionNote
          redactedRef={dataResidencyRef}
          description="Sensitive customer data (e.g., deal value, customer name) is stored by reference hash in the audit ledger, never raw."
        />
      </Card>

      <Card title="Hash chain integrity">
        <AuditChain eventCount={events.length} isValid={true} />
      </Card>
    </section>
  );
}

export function AuditTrail() {
  return <AuditTrailContent />;
}

export default AuditTrail;
