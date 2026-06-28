/**
 * Linear integration — adapters behind the governance Linear ports.
 *
 *  - `SimulatedLinearPanel` (the original FIXTURE STUB) implements
 *    `LinearWorkstreamPanel`: a read-only simulated workstream panel, no network.
 *  - `LinearRemediationAdapter` implements the `RemediationIssueClient` port
 *    (LIM-1335): it turns a governance remediation payload into a real Linear
 *    `issueCreate`. It runs in two modes:
 *      • DRY-RUN  — returns/prints the EXACT Linear payload, makes NO network call.
 *      • LIVE     — creates one real Linear issue, ONLY when explicitly opted in.
 *  - `LinearHttpClient` is the live transport (a real Linear GraphQL call); it is
 *    injected into the adapter so tests can substitute a fake at the port boundary
 *    WITHOUT a network call — the adapter logic itself is never faked.
 *
 * QUARANTINE: this package is wired ONLY from an apps/ composition root (or the
 * `remediation-cli`). The demo spine (engine-core / governance / ui-components)
 * must NOT import it — governance depends on the PORT, not this adapter
 * (fixtures-before-integrations; enforced by `.dependency-cruiser.cjs`). No secrets
 * in code: live credentials are read from the environment at the composition root.
 */
import {
  linearRemediationIssueContract,
  type JsonObject,
  type LinearRemediationIssuePayload,
} from "@liminal-engine/contracts";
import type {
  LinearWorkstreamPanel,
  RemediationIssueClient,
  RemediationIssueRef,
  RemediationIssueResult,
} from "@liminal-engine/governance";

// ── existing fixture stub (read-only workstream panel) ───────────────────────

// must-not-cut #4: the workstream demands the right owners.
const REQUIRED_OWNERS = ["Product", "Security", "Engineering"] as const;

export class SimulatedLinearPanel implements LinearWorkstreamPanel {
  async workstreams(_dealId: string): Promise<{ title: string; status: string; owner: string }[]> {
    return [
      { title: "Commercial terms", status: "green", owner: "Product" },
      { title: "Security review", status: "green", owner: "Security" },
      { title: "Data residency (EU)", status: "at-risk", owner: "Engineering" }, // the corrected reality
    ];
  }

  /** Owners the workstream requires before a corrected update can proceed. */
  requiredOwners(): readonly string[] {
    return REQUIRED_OWNERS;
  }
}

// ── live transport seam (real Linear GraphQL `issueCreate`) ──────────────────

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<FetchResponseLike>;

/** The exact Linear `IssueCreateInput` the adapter sends — the "exact Linear payload". */
export interface LinearIssueCreateInput {
  teamId: string;
  title: string;
  description: string;
  projectId?: string;
  cycleId?: string;
  labelIds?: string[];
}

/** A created Linear issue, as returned by the API. */
export interface LinearIssueCreated {
  id: string;
  identifier?: string;
  url?: string;
  title: string;
}

/**
 * The low-level Linear transport. The live adapter depends on THIS interface, so a
 * test can inject a fake here (at the port boundary) and assert the exact payload
 * with no network call. `LinearHttpClient` is the real implementation.
 */
export interface LinearApiClient {
  createIssue(input: LinearIssueCreateInput): Promise<LinearIssueCreated>;
}

export interface LinearHttpClientConfig {
  /** Linear API key (a personal API key or OAuth token). Never hardcoded. */
  apiKey: string;
  /** GraphQL endpoint — defaults to Linear's public endpoint. */
  baseUrl?: string;
  timeoutMs?: number;
  /** auth scheme: personal keys send the raw key; OAuth tokens send `Bearer <token>`. */
  authScheme?: "api-key" | "bearer";
  /** injectable for tests; defaults to global `fetch`. */
  fetchImpl?: FetchLike;
}

const ISSUE_CREATE_MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url title }
  }
}`;

/**
 * LinearHttpClient — the real Linear transport. Builds the `issueCreate` GraphQL
 * mutation, POSTs it, and parses the created issue. This is genuine adapter logic
 * (Rule 6): tests exercise it with an injected fake `fetch` so the request shape
 * (URL / auth header / GraphQL body) is asserted WITHOUT a live call.
 */
export class LinearHttpClient implements LinearApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly authScheme: "api-key" | "bearer";
  private readonly fetchImpl: FetchLike;

  constructor(config: LinearHttpClientConfig) {
    if (config.apiKey.trim().length === 0) {
      throw new Error("LinearHttpClient requires a non-empty apiKey");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.linear.app/graphql").replace(/\/+$/g, "");
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.authScheme = config.authScheme ?? "api-key";
    this.fetchImpl = config.fetchImpl ?? (fetch as unknown as FetchLike);
  }

  async createIssue(input: LinearIssueCreateInput): Promise<LinearIssueCreated> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const authorization = this.authScheme === "bearer" ? `Bearer ${this.apiKey}` : this.apiKey;
    try {
      const response = await this.fetchImpl(this.baseUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization },
        body: JSON.stringify({ query: ISSUE_CREATE_MUTATION, variables: { input } }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await safeText(response);
        throw new Error(
          `Linear issueCreate failed: HTTP ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`,
        );
      }
      const payload = await response.json();
      return parseIssueCreateResponse(payload);
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ── the remediation adapter (implements the governance port) ─────────────────

export type RemediationMode = "dry-run" | "live";

export interface LinearRemediationAdapterConfig {
  /** `dry-run` prints the exact payload and makes NO call; `live` creates a real issue. */
  mode: RemediationMode;
  /** the Linear team the remediation issues are filed into (required in both modes). */
  teamId: string;
  /** the Linear project to route the issues to (optional). */
  projectId?: string;
  /** the Linear cycle to route the issues to (optional). */
  cycleId?: string;
  /** Linear label ids to attach (optional — Linear labels are referenced by id). */
  labelIds?: string[];
  /** the live transport — REQUIRED in live mode; ignored in dry-run. */
  client?: LinearApiClient;
  /** dry-run print sink — defaults to console.log. */
  log?: (line: string) => void;
}

/**
 * LinearRemediationAdapter — turns a governance `LinearRemediationIssuePayload`
 * into a Linear `issueCreate`. In dry-run it returns/prints the exact payload with
 * NO network call; in live it creates one real issue through the injected
 * `LinearApiClient`. The mapping logic (payload → `IssueCreateInput`, dry-run vs
 * live branching, response → `RemediationIssueRef`) is real adapter logic — only
 * the transport is injectable for tests (Rule 6).
 */
export class LinearRemediationAdapter implements RemediationIssueClient {
  private readonly mode: RemediationMode;
  private readonly teamId: string;
  private readonly projectId?: string;
  private readonly cycleId?: string;
  private readonly labelIds?: string[];
  private readonly client?: LinearApiClient;
  private readonly log: (line: string) => void;

  constructor(config: LinearRemediationAdapterConfig) {
    if (config.teamId.trim().length === 0) {
      throw new Error("LinearRemediationAdapter requires a non-empty teamId");
    }
    if (config.mode === "live" && config.client === undefined) {
      throw new Error("LinearRemediationAdapter live mode requires a LinearApiClient");
    }
    this.mode = config.mode;
    this.teamId = config.teamId;
    if (config.projectId !== undefined) this.projectId = config.projectId;
    if (config.cycleId !== undefined) this.cycleId = config.cycleId;
    if (config.labelIds !== undefined) this.labelIds = config.labelIds;
    if (config.client !== undefined) this.client = config.client;
    this.log = config.log ?? ((line) => console.log(line));
  }

  async create(payload: LinearRemediationIssuePayload): Promise<RemediationIssueResult> {
    // Parse untrusted input through the contract at the boundary.
    const validated = linearRemediationIssueContract.parse(payload);
    const input = this.toIssueCreateInput(validated);
    const providerRequest = toJsonObject(input);

    if (this.mode === "dry-run") {
      this.log(`[linear:dry-run] would create remediation issue:\n${JSON.stringify(input, null, 2)}`);
      return { mode: "dry-run", payload: validated, providerRequest };
    }

    // live — guarded by the constructor; assert for the type narrowing.
    if (this.client === undefined) {
      throw new Error("LinearRemediationAdapter live mode requires a LinearApiClient");
    }
    const created = await this.client.createIssue(input);
    const ref: RemediationIssueRef = {
      id: created.id,
      title: created.title,
      ...(created.identifier !== undefined ? { identifier: created.identifier } : {}),
      ...(created.url !== undefined ? { url: created.url } : {}),
    };
    return { mode: "live", payload: validated, providerRequest, created: ref };
  }

  private toIssueCreateInput(payload: LinearRemediationIssuePayload): LinearIssueCreateInput {
    return {
      teamId: this.teamId,
      title: payload.title,
      description: payload.description,
      ...(this.projectId !== undefined ? { projectId: this.projectId } : {}),
      ...(this.cycleId !== undefined ? { cycleId: this.cycleId } : {}),
      ...(this.labelIds !== undefined ? { labelIds: this.labelIds } : {}),
    };
  }
}

// ── composition-root env factory (live opt-in) ───────────────────────────────

export interface CreateLinearRemediationAdapterOptions {
  /** overrides for the live transport (e.g. an injected fetch in tests). */
  httpClientConfig?: Partial<Omit<LinearHttpClientConfig, "apiKey">>;
  /** dry-run print sink override. */
  log?: (line: string) => void;
  /** label ids override (Linear labels are referenced by id). */
  labelIds?: string[];
}

/**
 * Build a `LinearRemediationAdapter` from the environment — the composition-root
 * opt-in. It is DRY-RUN by default; LIVE only when `LINEAR_LIVE` is explicitly
 * truthy (`1`/`true`) AND `LINEAR_API_KEY` is present. `LINEAR_TEAM_ID` is required
 * (it is not a secret — it identifies the destination team for the exact payload).
 * Reads only the environment — never hardcodes credentials.
 */
export function createLinearRemediationAdapterFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: CreateLinearRemediationAdapterOptions = {},
): LinearRemediationAdapter {
  const teamId = env.LINEAR_TEAM_ID;
  if (teamId === undefined || teamId.trim().length === 0) {
    throw new Error("LINEAR_TEAM_ID is required to create a Linear remediation adapter");
  }
  const projectId = nonEmpty(env.LINEAR_PROJECT_ID);
  const cycleId = nonEmpty(env.LINEAR_CYCLE_ID);
  const liveEnabled = env.LINEAR_LIVE === "1" || env.LINEAR_LIVE === "true";

  const base: LinearRemediationAdapterConfig = {
    mode: liveEnabled ? "live" : "dry-run",
    teamId,
    ...(projectId !== undefined ? { projectId } : {}),
    ...(cycleId !== undefined ? { cycleId } : {}),
    ...(options.labelIds !== undefined ? { labelIds: options.labelIds } : {}),
    ...(options.log !== undefined ? { log: options.log } : {}),
  };

  if (!liveEnabled) {
    return new LinearRemediationAdapter(base);
  }

  const apiKey = env.LINEAR_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error("LINEAR_API_KEY is required to enable LINEAR_LIVE remediation");
  }
  const client = new LinearHttpClient({ apiKey, ...(options.httpClientConfig ?? {}) });
  return new LinearRemediationAdapter({ ...base, client });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.trim().length > 0 ? value : undefined;
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function parseIssueCreateResponse(payload: unknown): LinearIssueCreated {
  const root = asRecord(payload, "Linear response");
  if (root.errors !== undefined) {
    throw new Error(`Linear issueCreate returned errors: ${JSON.stringify(root.errors)}`);
  }
  const data = asRecord(root.data, "Linear response data");
  const issueCreate = asRecord(data.issueCreate, "Linear issueCreate");
  if (issueCreate.success !== true) {
    throw new Error("Linear issueCreate did not succeed");
  }
  const issue = asRecord(issueCreate.issue, "Linear issueCreate.issue");
  const id = stringField(issue.id, "issue.id");
  const title = stringField(issue.title, "issue.title");
  const identifier = optionalString(issue.identifier);
  const url = optionalString(issue.url);
  return {
    id,
    title,
    ...(identifier !== undefined ? { identifier } : {}),
    ...(url !== undefined ? { url } : {}),
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function safeText(response: FetchResponseLike): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
