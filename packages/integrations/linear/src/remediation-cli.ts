/**
 * remediation-cli — a composition-root entry point that wires the governance
 * remediation use case (`buildRemediationIssues` / `fileRemediationIssues`) to the
 * live/dry-run Linear adapter (LIM-1335). This is where the integration is allowed
 * to be imported — NOT the spine.
 *
 *   pnpm --filter @liminal-engine/integration-linear linear:remediation
 *     → DRY-RUN by default: prints the EXACT Linear payload(s), makes NO call.
 *
 *   LINEAR_LIVE=1 LINEAR_API_KEY=… LINEAR_TEAM_ID=… [LINEAR_PROJECT_ID=…] \
 *     pnpm --filter @liminal-engine/integration-linear linear:remediation
 *     → LIVE: creates one real Linear issue per required owner, ONLY when opted in.
 *
 * It seeds a representative violated hard active requirement (the Acme EU
 * data-residency requirement) + its detected GovernanceCase and the required
 * workstream owners, then files remediation through the adapter. Run it cold and it
 * works — no narrator, no fixed UI sequence.
 */
import {
  requirementContract,
  type Requirement,
} from "@liminal-engine/contracts";
import { fileRemediationIssues } from "@liminal-engine/governance";
import {
  SimulatedLinearPanel,
  createLinearRemediationAdapterFromEnv,
} from "./index.ts";

// A representative violated hard ACTIVE requirement + the case that detected it.
const violatedRequirement: Requirement = requirementContract.parse({
  id: "req_acme_eu_residency",
  goalId: "goal_acme_expansion",
  dealId: "deal_acme",
  text: "All Acme EU customer data must remain resident in EU data centers.",
  ownerRole: "Security",
  severity: "hard",
  scope: ["deal-proposal", "launch-plan", "owner-assignment", "customer-facing-status-update"],
  status: "active",
  createdBy: "operator",
  approvedBy: "VP Ops / Head of AI Transformation",
  evidenceRefs: ["call_acme_kickoff", "dpa_acme_v3"],
  createdAt: "2026-06-27T09:55:00.000Z",
  activatedAt: "2026-06-27T10:05:00.000Z",
});
const governanceCaseId = "gc_acme_eu";

async function main(): Promise<void> {
  const adapter = createLinearRemediationAdapterFromEnv();
  const requiredOwners = new SimulatedLinearPanel().requiredOwners();

  const results = await fileRemediationIssues(
    { requirement: violatedRequirement, governanceCaseId, requiredOwners },
    adapter,
  );

  const mode = results[0]?.mode ?? "dry-run";
  console.log(`\nfiled ${results.length} remediation issue(s) in ${mode} mode:`);
  for (const result of results) {
    const created = result.created;
    const suffix = created !== undefined ? ` → ${created.identifier ?? created.id} (${created.url ?? "no url"})` : "";
    console.log(`  - [${result.payload.ownerRole}${result.payload.accountableOwner ? "*" : ""}] ${result.payload.title}${suffix}`);
  }
  if (mode === "dry-run") {
    console.log("\n(dry-run — no Linear issues were created. Set LINEAR_LIVE=1 + LINEAR_API_KEY to file for real.)");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
