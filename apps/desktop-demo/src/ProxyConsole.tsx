/**
 * ProxyConsole — the inference plane ("Burp for LLM traffic", GOAL §16) as a first-
 * class operating surface, reconciled onto Shruti's Workspace design language (the
 * Card widget + canonical design tokens, never redefined here). This is the one
 * surface her Workspace does not cover: it governs the fleet's outbound Claude calls
 * — model-routing policy, company-mission alignment, and the self-learning loop that
 * proposes new policies from observed traffic. Renders the pure `evaluateProxy` /
 * `proposePolicies` results over editable seed traffic; no narrator, no fixed flow.
 */
import { useMemo, useState } from "react";
import type { SealedAuditEvent } from "@liminal-engine/governance";
import { Card } from "./components";
import {
  DEFAULT_MISSION,
  DEFAULT_MODEL_POLICIES,
  DEFAULT_PROXY_REQUESTS,
  MODELS,
  TIER_ORDER,
  evaluateProxy,
  proposePolicies,
  proposePoliciesLive,
  ratifyProposal,
  recordProxy,
  type ModelPolicy,
  type ModelTier,
  type PolicyProposal,
  type ProxyRequestDraft,
} from "./lib/proxy-surface.ts";
import "./styles/proxy.css";

const PROXY_URL = "http://localhost:8787";
const VERDICT_LABEL: Record<string, string> = { allow: "Forwarded", transform: "Forwarded · transformed", deny: "Blocked", ask: "Held" };

export function ProxyConsole() {
  const [requests, setRequests] = useState<ProxyRequestDraft[]>(DEFAULT_PROXY_REQUESTS);
  const [selectedId, setSelectedId] = useState(DEFAULT_PROXY_REQUESTS[0]!.id);
  const [policies, setPolicies] = useState<ModelPolicy[]>(DEFAULT_MODEL_POLICIES);
  const [events, setEvents] = useState<SealedAuditEvent[]>([]);
  const [live, setLive] = useState<{ proposals: PolicyProposal[]; source: "live" | "local" } | null>(null);

  const selected = requests.find((r) => r.id === selectedId) ?? requests[0]!;

  const evaluations = useMemo(
    () => requests.map((draft) => evaluateProxy(draft, policies, DEFAULT_MISSION)),
    [requests, policies],
  );
  const selectedEval = evaluations.find((e) => e.draft.id === selected.id) ?? evaluations[0]!;
  const gated = evaluations.filter((e) => e.verdict !== "allow").length;

  const deterministic = useMemo(
    () => proposePolicies(requests, policies, DEFAULT_MISSION, "2026-06-28T18:00:00.000Z"),
    [requests, policies],
  );
  const proposals = live?.proposals ?? deterministic;
  const proposerSource = live?.source ?? "local";

  function update<K extends keyof ProxyRequestDraft>(field: K, value: ProxyRequestDraft[K]) {
    setRequests((cur) => cur.map((r) => (r.id === selected.id ? { ...r, [field]: value } : r)));
    setLive(null);
  }
  function togglePolicyTier(policyId: string, tier: ModelTier) {
    setPolicies((cur) =>
      cur.map((p) => {
        if (p.id !== policyId) return p;
        const allowed = p.allowedTiers.includes(tier) ? p.allowedTiers.filter((t) => t !== tier) : [...p.allowedTiers, tier];
        return { ...p, allowedTiers: TIER_ORDER.filter((t) => allowed.includes(t)) };
      }),
    );
    setLive(null);
  }
  function ratify(proposal: PolicyProposal) {
    setPolicies((cur) => [...cur, ratifyProposal(proposal)]);
    setLive(null);
  }
  function recordDecision() {
    setEvents((cur) => recordProxy(cur, selectedEval).events);
  }
  async function runProposerLive() {
    const result = await proposePoliciesLive(requests, policies, DEFAULT_MISSION, new Date().toISOString(), { fetch, proxyUrl: PROXY_URL });
    setLive(result);
  }

  return (
    <div className="proxy">
      <header className="proxy__head">
        <p className="proxy__eyebrow">Inference proxy · Burp for LLM traffic</p>
        <h1 className="proxy__title">{DEFAULT_MISSION.statement}</h1>
        <p className="proxy__spend">
          <strong>{requests.length}</strong> Claude calls intercepted · <strong>{gated}</strong> gated by policy or mission ·{" "}
          <strong>{events.length}</strong> sealed to the audit ledger
        </p>
        <div className="proxy__mission-tags">
          {DEFAULT_MISSION.objectives.map((o) => (
            <span className="proxy__tag" key={o}>{o}</span>
          ))}
        </div>
      </header>

      <div className="proxy__grid">
        <Card title="Intercepted Claude calls" className="proxy__queue-card">
          <ul className="proxy__queue">
            {evaluations.map((e) => (
              <li key={e.draft.id}>
                <button
                  type="button"
                  className={`proxy__row${e.draft.id === selected.id ? " is-selected" : ""}`}
                  aria-current={e.draft.id === selected.id ? "true" : undefined}
                  onClick={() => setSelectedId(e.draft.id)}
                >
                  <span className={`proxy__verdict proxy__verdict--${e.verdict}`}>{e.verdict}</span>
                  <span className="proxy__row-body">
                    <strong>{e.draft.workstream}</strong>
                    <span>
                      <span className={`proxy__model proxy__model--${e.requestedModel}`}>{MODELS[e.requestedModel].label}</span> · {e.draft.engineer}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="proxy__editor">
            <label className="proxy__field">
              <span>Workstream</span>
              <input value={selected.workstream} onChange={(ev) => update("workstream", ev.currentTarget.value)} />
            </label>
            <label className="proxy__field">
              <span>Model requested</span>
              <select value={selected.model} onChange={(ev) => update("model", ev.currentTarget.value as ModelTier)}>
                {TIER_ORDER.map((t) => (
                  <option key={t} value={t}>{MODELS[t].label}</option>
                ))}
              </select>
            </label>
            <label className="proxy__field proxy__field--full">
              <span>Task / prompt intent</span>
              <textarea value={selected.intent} rows={2} onChange={(ev) => update("intent", ev.currentTarget.value)} />
            </label>
          </div>
        </Card>

        <div className="proxy__col">
          <Card
            title="Gate verdict"
            className={selectedEval.verdict === "deny" ? "proxy__risk" : selectedEval.verdict === "allow" ? "proxy__aligned" : "proxy__warn"}
          >
            <p className="proxy__verdict-line">
              <span className={`proxy__verdict proxy__verdict--${selectedEval.verdict}`}>{selectedEval.verdict}</span>
              <span>{VERDICT_LABEL[selectedEval.verdict]}</span>
            </p>
            <p className="proxy__routing">
              <span className={`proxy__model proxy__model--${selectedEval.requestedModel}`}>{MODELS[selectedEval.requestedModel].label}</span>
              <span aria-hidden="true"> → </span>
              <span className={`proxy__model proxy__model--${selectedEval.effectiveModel}`}>{MODELS[selectedEval.effectiveModel].label}</span>
            </p>
            {selectedEval.reasons.length > 0 && (
              <ul className="proxy__reasons">
                {selectedEval.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
            <p className={`proxy__mission proxy__mission--${selectedEval.missionAligned ? "ok" : "off"}`}>
              {selectedEval.missionAligned ? "In line with company mission" : "Off-mission — not in company objectives"}
            </p>
            <dl className="proxy__hashes">
              <div><dt>Request hash</dt><dd>{selectedEval.requestHash.slice(0, 24)}…</dd></div>
              <div><dt>Matched policy</dt><dd>{selectedEval.matchedPolicy?.id ?? "none (default-forward)"}</dd></div>
            </dl>
            <button type="button" className="proxy__btn" onClick={recordDecision}>Seal verdict to ledger</button>
          </Card>

          <Card title="Model-routing policy" className="proxy__policy-card">
            {policies.map((p) => (
              <div className="proxy__policy" key={p.id}>
                <div className="proxy__policy-head">
                  <strong>{p.workstream}</strong>
                  <span className={`proxy__src proxy__src--${p.source === "ai-proposed" ? "ai" : "op"}`}>{p.source}</span>
                </div>
                <div className="proxy__tiers" role="group" aria-label={`Allowed models for ${p.workstream}`}>
                  {TIER_ORDER.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`proxy__tier proxy__tier--${t}${p.allowedTiers.includes(t) ? " is-on" : ""}`}
                      aria-pressed={p.allowedTiers.includes(t)}
                      onClick={() => togglePolicyTier(p.id, t)}
                    >
                      {MODELS[t].label.replace("Claude ", "")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          <Card title="Self-learning loop — proposed policies" className="proxy__learn-card">
            <p className="proxy__learn-meta">
              <span className={`proxy__src proxy__src--${proposerSource === "live" ? "ai" : "op"}`}>
                {proposerSource === "live" ? "live (DO proxy)" : "local heuristics"}
              </span>
              <button type="button" className="proxy__btn proxy__btn--ghost" onClick={() => void runProposerLive()}>Re-run proposer</button>
            </p>
            {proposals.length === 0 ? (
              <p className="proxy__empty">No policy gaps — every observed workstream is governed and on-mission.</p>
            ) : (
              <ul className="proxy__proposals">
                {proposals.map((p) => (
                  <li className="proxy__proposal" key={p.policy.id}>
                    <div className="proxy__proposal-head">
                      <span className={`proxy__kind proxy__kind--${p.kind}`}>{p.kind === "model-routing" ? "model routing" : "mission"}</span>
                      <strong>{p.policy.workstream}</strong>
                      {p.savingsPct !== null && <span className="proxy__savings">~{p.savingsPct}% cheaper</span>}
                    </div>
                    <p className="proxy__proposal-why">{p.rationale}</p>
                    <button type="button" className="proxy__btn" onClick={() => ratify(p)}>Ratify &amp; activate</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
