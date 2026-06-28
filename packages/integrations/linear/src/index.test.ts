import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linearRemediationIssueContract,
  type LinearRemediationIssuePayload,
  type Requirement,
} from "@liminal-engine/contracts";
import { buildRemediationIssues } from "@liminal-engine/governance";
import {
  LinearHttpClient,
  LinearRemediationAdapter,
  SimulatedLinearPanel,
  createLinearRemediationAdapterFromEnv,
  type FetchLike,
  type FetchResponseLike,
  type LinearApiClient,
  type LinearIssueCreateInput,
  type LinearIssueCreated,
} from "./index.ts";

function jsonResponse(payload: unknown, status = 200): FetchResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "ERROR",
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function samplePayload(overrides: Partial<LinearRemediationIssuePayload> = {}): LinearRemediationIssuePayload {
  return linearRemediationIssueContract.parse({
    title: "[Remediation] EU data residency — Security",
    requirementId: "req_acme_eu_residency",
    governanceCaseId: "gc_acme_eu",
    dealId: "deal_acme",
    ownerRole: "Security",
    accountableOwner: true,
    severity: "hard",
    evidenceRefs: ["call_acme_kickoff", "dpa_acme_v3"],
    description: "Requirement (req_acme_eu_residency): EU data residency.\nGovernanceCase: gc_acme_eu",
    labels: ["remediation", "governance", "severity:hard", "owner:Security"],
    ...overrides,
  });
}

/** A fake transport that records inputs — substituted at the port boundary (no network). */
class FakeLinearApiClient implements LinearApiClient {
  readonly inputs: LinearIssueCreateInput[] = [];
  private readonly result: LinearIssueCreated;
  constructor(result: LinearIssueCreated) {
    this.result = result;
  }
  async createIssue(input: LinearIssueCreateInput): Promise<LinearIssueCreated> {
    this.inputs.push(input);
    return this.result;
  }
}

/** A transport that fails the test if ever called — proves dry-run makes no call. */
class ExplodingApiClient implements LinearApiClient {
  async createIssue(): Promise<LinearIssueCreated> {
    throw new Error("dry-run must not call the Linear transport");
  }
}

// ── SimulatedLinearPanel (existing fixture stub) ─────────────────────────────

test("SimulatedLinearPanel still serves the Product/Security/Engineering required owners", async () => {
  const panel = new SimulatedLinearPanel();
  assert.deepEqual([...panel.requiredOwners()], ["Product", "Security", "Engineering"]);
  const ws = await panel.workstreams("deal_acme");
  assert.deepEqual(ws.map((w) => w.owner), ["Product", "Security", "Engineering"]);
});

// ── dry-run: prints the EXACT payload, NO network call ───────────────────────

test("dry-run returns the exact Linear payload and makes NO transport call", async () => {
  const lines: string[] = [];
  const adapter = new LinearRemediationAdapter({
    mode: "dry-run",
    teamId: "TEAM_TEST",
    projectId: "PROJ_TEST",
    client: new ExplodingApiClient(), // present but must never be called in dry-run
    log: (line) => lines.push(line),
  });

  const payload = samplePayload();
  const result = await adapter.create(payload);

  assert.equal(result.mode, "dry-run");
  assert.equal(result.created, undefined);
  assert.deepEqual(result.payload, payload);
  // the exact Linear issueCreate input is exposed for byte-for-byte printing.
  assert.deepEqual(result.providerRequest, {
    teamId: "TEAM_TEST",
    title: payload.title,
    description: payload.description,
    projectId: "PROJ_TEST",
  });
  assert.equal(lines.length, 1);
  assert.ok(lines[0]!.includes("[linear:dry-run]"));
  assert.ok(lines[0]!.includes(payload.title));
});

// ── live: creates one issue through the injected transport ───────────────────

test("live mode sends the exact issueCreate input and maps the created issue", async () => {
  const client = new FakeLinearApiClient({
    id: "issue_123",
    identifier: "SEC-42",
    url: "https://linear.app/acme/issue/SEC-42",
    title: "[Remediation] EU data residency — Security",
  });
  const adapter = new LinearRemediationAdapter({
    mode: "live",
    teamId: "TEAM_TEST",
    projectId: "PROJ_TEST",
    cycleId: "CYCLE_1",
    labelIds: ["lbl_remediation"],
    client,
  });

  const payload = samplePayload();
  const result = await adapter.create(payload);

  assert.equal(client.inputs.length, 1);
  assert.deepEqual(client.inputs[0], {
    teamId: "TEAM_TEST",
    title: payload.title,
    description: payload.description,
    projectId: "PROJ_TEST",
    cycleId: "CYCLE_1",
    labelIds: ["lbl_remediation"],
  });
  assert.equal(result.mode, "live");
  assert.deepEqual(result.created, {
    id: "issue_123",
    identifier: "SEC-42",
    url: "https://linear.app/acme/issue/SEC-42",
    title: "[Remediation] EU data residency — Security",
  });
});

test("live mode requires a transport client at construction", () => {
  assert.throws(
    () => new LinearRemediationAdapter({ mode: "live", teamId: "TEAM_TEST" }),
    /live mode requires a LinearApiClient/,
  );
});

test("adapter requires a non-empty teamId", () => {
  assert.throws(
    () => new LinearRemediationAdapter({ mode: "dry-run", teamId: "  " }),
    /non-empty teamId/,
  );
});

// ── LinearHttpClient (real transport) with a fake fetch (no network) ─────────

test("LinearHttpClient posts the issueCreate GraphQL mutation and parses the created issue", async () => {
  const calls: Array<{ input: string; init: RequestInit }> = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push({ input, init });
    return jsonResponse({
      data: { issueCreate: { success: true, issue: { id: "iss_1", identifier: "ENG-7", url: "https://linear.app/x/ENG-7", title: "T" } } },
    });
  };
  const client = new LinearHttpClient({ apiKey: "lin_test_key", fetchImpl });

  const created = await client.createIssue({ teamId: "TEAM_TEST", title: "T", description: "D", projectId: "P" });

  assert.deepEqual(created, { id: "iss_1", identifier: "ENG-7", url: "https://linear.app/x/ENG-7", title: "T" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.input, "https://api.linear.app/graphql");
  assert.equal(calls[0]!.init.method, "POST");
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers.authorization, "lin_test_key"); // personal API key → raw, no Bearer
  const body = JSON.parse(calls[0]!.init.body as string) as { query: string; variables: { input: LinearIssueCreateInput } };
  assert.ok(body.query.includes("issueCreate"));
  assert.deepEqual(body.variables.input, { teamId: "TEAM_TEST", title: "T", description: "D", projectId: "P" });
});

test("LinearHttpClient sends a Bearer header for OAuth tokens", async () => {
  let captured = "";
  const fetchImpl: FetchLike = async (_input, init) => {
    captured = (init.headers as Record<string, string>).authorization!;
    return jsonResponse({ data: { issueCreate: { success: true, issue: { id: "iss_1", title: "T" } } } });
  };
  const client = new LinearHttpClient({ apiKey: "oauth_tok", authScheme: "bearer", fetchImpl });
  await client.createIssue({ teamId: "T", title: "T", description: "D" });
  assert.equal(captured, "Bearer oauth_tok");
});

test("LinearHttpClient throws on an HTTP error response", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ error: "nope" }, 401);
  const client = new LinearHttpClient({ apiKey: "k", fetchImpl });
  await assert.rejects(
    () => client.createIssue({ teamId: "T", title: "T", description: "D" }),
    /HTTP 401/,
  );
});

test("LinearHttpClient throws when issueCreate did not succeed", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ data: { issueCreate: { success: false, issue: null } } });
  const client = new LinearHttpClient({ apiKey: "k", fetchImpl });
  await assert.rejects(
    () => client.createIssue({ teamId: "T", title: "T", description: "D" }),
    /did not succeed/,
  );
});

test("LinearHttpClient surfaces GraphQL errors", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ errors: [{ message: "bad team" }] });
  const client = new LinearHttpClient({ apiKey: "k", fetchImpl });
  await assert.rejects(() => client.createIssue({ teamId: "T", title: "T", description: "D" }), /returned errors/);
});

test("LinearHttpClient requires a non-empty apiKey", () => {
  assert.throws(() => new LinearHttpClient({ apiKey: "" }), /non-empty apiKey/);
});

// ── env factory (composition-root opt-in) ────────────────────────────────────

test("env factory defaults to DRY-RUN when LINEAR_LIVE is unset", async () => {
  const adapter = createLinearRemediationAdapterFromEnv({ LINEAR_TEAM_ID: "TEAM_TEST" } as NodeJS.ProcessEnv);
  const result = await adapter.create(samplePayload());
  assert.equal(result.mode, "dry-run");
});

test("env factory requires LINEAR_TEAM_ID", () => {
  assert.throws(
    () => createLinearRemediationAdapterFromEnv({} as NodeJS.ProcessEnv),
    /LINEAR_TEAM_ID is required/,
  );
});

test("env factory enables LIVE only when LINEAR_LIVE=1 AND a key is present (no network via injected fetch)", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (input) => {
    calls.push(input);
    return jsonResponse({ data: { issueCreate: { success: true, issue: { id: "iss_live", title: "T" } } } });
  };
  const adapter = createLinearRemediationAdapterFromEnv(
    { LINEAR_TEAM_ID: "TEAM_TEST", LINEAR_LIVE: "1", LINEAR_API_KEY: "lin_key", LINEAR_PROJECT_ID: "PROJ" } as NodeJS.ProcessEnv,
    { httpClientConfig: { fetchImpl } },
  );
  const result = await adapter.create(samplePayload());
  assert.equal(result.mode, "live");
  assert.equal(result.created?.id, "iss_live");
  assert.equal(calls.length, 1);
});

test("env factory refuses LIVE without LINEAR_API_KEY", () => {
  assert.throws(
    () => createLinearRemediationAdapterFromEnv({ LINEAR_TEAM_ID: "TEAM_TEST", LINEAR_LIVE: "1" } as NodeJS.ProcessEnv),
    /LINEAR_API_KEY is required/,
  );
});

// ── end-to-end: governance use case → adapter, no network ────────────────────

test("end-to-end: governance buildRemediationIssues → dry-run adapter files the exact payloads (no network)", async () => {
  const requirement: Requirement = {
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
  };
  const requiredOwners = new SimulatedLinearPanel().requiredOwners();
  const payloads = buildRemediationIssues({ requirement, governanceCaseId: "gc_acme_eu", requiredOwners });

  const adapter = new LinearRemediationAdapter({
    mode: "dry-run",
    teamId: "TEAM_TEST",
    client: new ExplodingApiClient(),
    log: () => {},
  });

  const results = [];
  for (const p of payloads) results.push(await adapter.create(p));

  assert.deepEqual(results.map((r) => r.payload.ownerRole), ["Product", "Security", "Engineering"]);
  assert.ok(results.every((r) => r.mode === "dry-run" && r.created === undefined));
  // the provider request carries the governed body for each owner.
  for (const r of results) {
    assert.equal((r.providerRequest as { teamId: string }).teamId, "TEAM_TEST");
    assert.ok((r.providerRequest as { description: string }).description.includes("req_acme_eu_residency"));
  }
});
