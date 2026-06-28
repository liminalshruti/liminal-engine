/**
 * EnforceActionPanel — the operator's "Approve + Enforce" surface (DEMO_CONTRACT
 * beat #6, LIM-1169). The operator action (the button click) TRIGGERS the enforce
 * handler, which flips the deal status On Track → At Risk and OPENS the
 * action-gate state for the downstream customer-facing update.
 *
 * Self-contained + fixture-backed: it holds its own enforce state and renders the
 * real governance output via the shared components (StatusBadge, BlockedActionBanner,
 * Card). It is the reusable enforce surface the EnforcementPanel screen / shell
 * mount on the demo path; an optional `onEnforced` callback lets a parent screen
 * reveal the downstream beats (status change, audit, eval) once enforcement runs.
 *
 * No live calls on the spine — `runApproveAndEnforce()` is deterministic. No
 * invented persona name — the deciding actor is a role from the locked fixtures.
 */
import { useCallback, useState } from "react";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import type { ApproveAndEnforceResult } from "@liminal-engine/governance";
import { StatusBadge, BlockedActionBanner, Card } from "./components";
import { runApproveAndEnforce, PRE_ENFORCE_STATUS } from "./lib/enforce-handler.ts";
import "./EnforceActionPanel.css";

export interface EnforceActionPanelProps {
  /** Called once enforcement completes — lets a parent screen reveal beats #7–#14. */
  onEnforced?: (result: ApproveAndEnforceResult) => void;
}

export function EnforceActionPanel({ onEnforced }: EnforceActionPanelProps) {
  const [result, setResult] = useState<ApproveAndEnforceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const { governanceCase } = acmeScenario;

  const onApproveEnforce = useCallback(async () => {
    if (result || busy) return; // guard against a double enforce
    setBusy(true);
    try {
      const enforced = await runApproveAndEnforce();
      setResult(enforced);
      onEnforced?.(enforced);
    } finally {
      setBusy(false);
    }
  }, [result, busy, onEnforced]);

  const status = result ? result.status : PRE_ENFORCE_STATUS;

  return (
    <Card title="Approve + Enforce" className="enforce-panel">
      <div className="enforce-panel__status-row">
        <span className="enforce-panel__status-label">Deal status</span>
        <StatusBadge status={status} />
      </div>

      <p className="enforce-panel__case">
        Governance case <code>{governanceCase.id}</code>: the{" "}
        <strong>{governanceCase.missedRequirement}</strong> requirement was silently
        dropped. Approving applies the correction — it flips the deal status and gates
        the downstream customer-facing update until the case is fixed.
      </p>

      {result === null ? (
        <button
          type="button"
          className="enforce-panel__cta"
          onClick={onApproveEnforce}
          disabled={busy}
        >
          {busy ? "Enforcing…" : "Approve + Enforce"}
        </button>
      ) : (
        <div className="enforce-panel__result">
          <p className="enforce-panel__flip" role="status">
            Status flipped <strong>On Track → At Risk</strong> · enforced by{" "}
            {result.enforcement.actor}.
          </p>
          <p className="enforce-panel__audit">
            Audit evidence recorded (<code>{result.audit.id}</code>): {result.audit.action}.
          </p>
          <BlockedActionBanner gate={result.gate} />
          <p className="enforce-panel__enforced-note" aria-live="polite">
            Downstream action gate opened — the customer-facing “on track” update is
            blocked until the case is corrected.
          </p>
        </div>
      )}
    </Card>
  );
}

export default EnforceActionPanel;
