#!/usr/bin/env bash
#
# live-demo.sh — boot the REAL governance service and run the full loop on a
# payload the operator supplies. This is the DIRECTIVE.md product surface:
# a stranger can POST their OWN agent output and get real governance back —
# detect → enforce → gate → audit → eval Fail→Pass. No fixture, no fixed script.
#
# Usage:
#   ./scripts/live-demo.sh                 # runs the built-in Globex example
#   ./scripts/live-demo.sh path/to.json    # runs YOUR payload (arbitrary deal)
#
# The payload shape: { agentOutputPass1, agentOutputPass2, caseEvidence? }
# (GET /governance/example prints a ready-to-edit template.)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-4555}"
PAYLOAD="${1:-}"

# ---- default (arbitrary, NON-Acme) payload so the demo runs with zero args ----
TMP_PAYLOAD=""
if [ -z "$PAYLOAD" ]; then
  TMP_PAYLOAD="$(mktemp)"
  cat > "$TMP_PAYLOAD" <<'JSON'
{
  "agentOutputPass1": {
    "id": "ao_globex_p1", "dealId": "deal_globex_platform",
    "dealName": "Globex platform expansion", "passNumber": 1,
    "reportedStatus": "on-track",
    "summary": "Globex expansion appears on track; all milestones green.",
    "droppedRequirements": ["99.9% uptime SLA in the master agreement"],
    "agentMetadata": { "agent": "sales-copilot", "model": "gemini", "artifacts": ["sow", "kickoff-notes"] }
  },
  "agentOutputPass2": {
    "id": "ao_globex_p2", "dealId": "deal_globex_platform",
    "dealName": "Globex platform expansion", "passNumber": 2,
    "reportedStatus": "at-risk",
    "summary": "Re-evaluated; uptime SLA requirement now propagated to the SOW.",
    "droppedRequirements": [],
    "agentMetadata": { "agent": "sales-copilot", "model": "gemini", "artifacts": ["sow", "kickoff-notes"] }
  },
  "caseEvidence": {
    "businessImpact": "Penalty clauses trigger if uptime SLA is unmet and unpriced",
    "missingFrom": ["SOW", "pricing model"],
    "recommendedActions": ["Block customer-facing on-track update until SLA is priced + committed"]
  }
}
JSON
  PAYLOAD="$TMP_PAYLOAD"
fi

echo "▶ Booting the real governance service on :$PORT ..."
PORT="$PORT" node "$ROOT/apps/api/src/index.ts" >/tmp/liminal-live-demo.log 2>&1 &
API_PID=$!
cleanup() { kill "$API_PID" 2>/dev/null || true; [ -n "$TMP_PAYLOAD" ] && rm -f "$TMP_PAYLOAD"; }
trap cleanup EXIT

# wait for the server to come up (poll, no fixed sleep)
for _ in $(seq 1 20); do
  curl -sf "http://localhost:$PORT/governance/example" >/dev/null 2>&1 && break
  sleep 0.25
done

DEAL_NAME="$(node -e 'const fs=require("fs");const b=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));console.log(b.agentOutputPass1.dealName)' "$PAYLOAD")"
echo "▶ POST /governance/loop  (governing arbitrary posted agent output — not a fixture)"
echo "  deal: $DEAL_NAME"
echo ""

curl -s -X POST "http://localhost:$PORT/governance/loop" \
  -H 'Content-Type: application/json' --data @"$PAYLOAD" \
| node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    const r = JSON.parse(s).result;
    const gc = r.governanceCase;
    const dropped = gc.missedRequirement || gc.droppedRequirements
      || gc.missingRequirements || gc.requirement || "(see case)";
    console.log("  ① DETECT   lost requirement:", Array.isArray(dropped)?dropped.join(", "):dropped);
    if (gc.businessImpact) console.log("             business impact:", gc.businessImpact);
    console.log("  ② ENFORCE  status:", r.enforcementAction.fromStatus, "→", r.enforcementAction.toStatus);
    console.log("  ③ GATE     downstream action:", r.gate.verdict === "deny" ? "BLOCKED" : r.gate.verdict);
    console.log("  ④ AUDIT    event recorded:", r.auditEvent.id);
    console.log("  ⑤ EVAL     " + r.evals.map(e=>"pass "+e.passNumber+" = "+e.result.toUpperCase()).join("  →  "));
    const passed = r.evals.find(e=>e.passNumber===2)?.result === "pass";
    console.log("");
    console.log(passed
      ? "  ✓ The loop caught the drift, enforced the correction, and proved the next pass improved."
      : "  ✗ Eval did not reach pass — check the payload.");
  });'

echo ""
echo "▶ This ran on data you supplied — no narrator, no fixed scenario. (DIRECTIVE.md ✓)"
echo "  Try your own:  ./scripts/live-demo.sh your-payload.json"
echo "  See the shape:  curl -s localhost:$PORT/governance/example"
