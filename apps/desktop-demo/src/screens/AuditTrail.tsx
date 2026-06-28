/**
 * AuditTrail screen — demo beat #11 of the locked required path (DEMO_CONTRACT.md):
 *   #11  AuditEvent recorded (MNC#6) — the correction + the deciding actor captured
 *        as tamper-evident audit evidence (before/after status, case ref, timestamp).
 *
 * Fills the LIM-1226 «spine-shell-v2» stub (task LIM-1220 «screen-audit-trail»). The
 * deciding actor is rendered straight from the fixture, which holds a ROLE, never an
 * invented persona name (apps/desktop-demo/AGENTS.md Locked Rules).
 *
 * Demo facts source (LIM-1255): the audit event comes from the live governance loop
 * (`useDemo().auditEvent` — the real engine driving the UI). The data-residency proof
 * (LIM-1248) displays the fixture-driven redacted reference showing sensitive data
 * storage by hash — the `dataResidencyRef` from `acmeScenario` supplements the
 * live-wire audit event with fixture-driven governance proof.
 *
 * Data-residency note (LIM-1248): a small additive panel proving sensitive customer
 * data is recorded by reference/hash, never raw. The reference is the redacted
 * `RedactedRef` the audit ledger stores (`acmeScenario.dataResidencyRef`), built from
 * the single-source fixture via the real `redact` helper — fixture-driven, simulated.
 */
import { Card, TraceRow } from "../components";
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
        <dl className="redaction-ref">
          <div className="redaction-ref__row">
            <dt className="redaction-ref__label">Field</dt>
            <dd className="redaction-ref__value">{dataResidencyRef.label}</dd>
          </div>
          <div className="redaction-ref__row">
            <dt className="redaction-ref__label">Stored as</dt>
            <dd className="redaction-ref__value">{dataResidencyRef.scheme} reference (redacted)</dd>
          </div>
          <div className="redaction-ref__row">
            <dt className="redaction-ref__label">Reference</dt>
            <dd className="redaction-ref__value redaction-ref__hash">{dataResidencyRef.hash}</dd>
          </div>
        </dl>
      </Card>
    </section>
  );
}

export function AuditTrail() {
  return <AuditTrailContent />;
}

export default AuditTrail;
