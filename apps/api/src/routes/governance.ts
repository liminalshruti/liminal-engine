/**
 * POST /governance/* routes — a REAL governance service over ARBITRARY posted
 * agent output.
 *
 * The caller POSTs the agent output(s) they want governed (any deal, any subject,
 * any dropped requirement). The service validates the body against the
 * AgentOutput contract at the edge, runs the genuine governance loop phases
 * (observe → detect → correct → enforce → audit → improve) over an in-memory,
 * per-request adapter set, and returns the contract JSON it produced. Nothing is
 * looked up from a hardcoded fixture — a stranger can point this at THEIR own data.
 *
 * Determinism is INJECTED (Clock / IdGen), never Date.now() / Math.random(), so
 * tests can pass fixed instances. Every request gets a FRESH idGen + store set so
 * runs never bleed into each other.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type AgentOutput,
  agentOutputContract,
  dealStatus,
  type DealStatus,
  type GovernanceCase,
  type EnforcementAction,
  type AuditEvent,
  type ActionGate,
  type ActionGateDecision,
  type EvalResult,
} from "@liminal-engine/contracts";
import {
  detectMiss,
  enforceCorrection,
  gradeSecondPass,
  runGovernanceLoop,
  type AgentOutputSource,
  type GovernanceCaseStore,
  type AuditSink,
  type ActionGateStore,
  type EvalStore,
  type Clock,
  type IdGen,
  type CaseEvidence,
  type GovernanceLoopResult,
} from "@liminal-engine/governance";
import { runEvals, type EvalTable } from "@liminal-engine/eval-harness";

/* -------------------------------------------------------------------------- */
/* Determinism — injected real Clock / IdGen (no hardcoded Acme ids).         */
/* -------------------------------------------------------------------------- */

/** Real wall-clock source — emits a real ISO-8601 timestamp per call. */
export class RealClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}

/**
 * Real, monotonic id generator: `${prefix}-${counter}`. Unique per run and per
 * instance — NOT the hardcoded Acme ids. A fresh instance is built per request so
 * ids never collide or bleed across requests. Tests inject a fixed-prefix instance
 * to assert stable ids.
 */
export class SequentialIdGen implements IdGen {
  private counter = 0;
  private readonly prefix: string;
  // NB: an explicit field + body assignment (not a TS parameter property) — Node's
  // strip-only TS execution rejects `constructor(private prefix: ...)`.
  constructor(prefix = "lim") {
    this.prefix = prefix;
  }
  next(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}

/* -------------------------------------------------------------------------- */
/* Inline agent-output source — built from the POSTED outputs, not a fixture.  */
/* -------------------------------------------------------------------------- */

/**
 * AgentOutputSource backed by the agent output(s) supplied on the request. Keyed
 * by pass number, so `getOutput(dealId, n)` returns the posted output for pass n.
 * Throws a clear error if a requested pass was not provided (e.g. the loop asks
 * for pass 2 but only pass 1 was posted).
 */
export class InlineAgentOutputSource implements AgentOutputSource {
  private readonly byPass: Map<number, AgentOutput>;

  constructor(outputs: Map<number, AgentOutput>) {
    this.byPass = new Map(outputs);
  }

  async getOutput(dealId: string, passNumber: number): Promise<AgentOutput> {
    const output = this.byPass.get(passNumber);
    if (!output) {
      throw new Error(
        `no agent output provided for pass ${passNumber} (deal ${dealId})`,
      );
    }
    return output;
  }
}

/* -------------------------------------------------------------------------- */
/* In-memory adapters — each holds its OWN backing maps (per-request, no global).*/
/* -------------------------------------------------------------------------- */

class InMemoryGovernanceCaseStore implements GovernanceCaseStore {
  private readonly cases = new Map<string, GovernanceCase>();

  async open(governanceCase: GovernanceCase): Promise<void> {
    this.cases.set(governanceCase.id, governanceCase);
  }

  async correct(caseId: string): Promise<void> {
    const gc = this.cases.get(caseId);
    if (gc) {
      gc.status = "corrected";
      this.cases.set(caseId, gc);
    }
  }

  async byDeal(dealId: string): Promise<GovernanceCase[]> {
    return Array.from(this.cases.values()).filter((gc) => gc.dealId === dealId);
  }
}

class InMemoryAuditSink implements AuditSink {
  private readonly events = new Map<string, AuditEvent>();

  async record(event: AuditEvent): Promise<void> {
    this.events.set(event.id, event);
  }

  async all(): Promise<AuditEvent[]> {
    return Array.from(this.events.values());
  }
}

class InMemoryActionGateStore implements ActionGateStore {
  private readonly gates = new Map<string, ActionGate>();

  async gate(gate: ActionGate): Promise<void> {
    this.gates.set(gate.action, gate);
  }

  async decisionFor(action: string): Promise<ActionGateDecision> {
    const gate = this.gates.get(action);
    if (!gate) return { allowed: true, reasons: [], requiredBeforeSend: [] };
    return {
      allowed: gate.verdict === "allow",
      reasons: gate.reasons,
      requiredBeforeSend: gate.requiredBeforeSend,
    };
  }
}

class InMemoryEvalStore implements EvalStore {
  private readonly results = new Map<string, EvalResult>();

  async record(result: EvalResult): Promise<void> {
    const key = `${result.dealId}:${result.criterion}:${result.passNumber}`;
    this.results.set(key, result);
  }

  async byDeal(dealId: string): Promise<EvalResult[]> {
    return Array.from(this.results.values()).filter((er) => er.dealId === dealId);
  }
}

interface RequestStores {
  caseStore: InMemoryGovernanceCaseStore;
  auditSink: InMemoryAuditSink;
  actionGateStore: InMemoryActionGateStore;
  evalStore: InMemoryEvalStore;
}

/** Build a fresh, isolated adapter set for a single request — no shared state. */
function createStores(): RequestStores {
  return {
    caseStore: new InMemoryGovernanceCaseStore(),
    auditSink: new InMemoryAuditSink(),
    actionGateStore: new InMemoryActionGateStore(),
    evalStore: new InMemoryEvalStore(),
  };
}

/* -------------------------------------------------------------------------- */
/* HTTP helpers                                                                */
/* -------------------------------------------------------------------------- */

/** Reads + JSON-parses a request body into a record (never `any`). */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const data: unknown = body ? JSON.parse(body) : {};
        if (data === null || typeof data !== "object" || Array.isArray(data)) {
          resolve({});
          return;
        }
        resolve(data as Record<string, unknown>);
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

/** Validate a posted value against the AgentOutput contract at the edge. */
function parseAgentOutput(
  value: unknown,
  label: string,
): { ok: true; value: AgentOutput } | { ok: false; message: string } {
  const result = agentOutputContract.safeParse(value);
  if (result.success) return { ok: true, value: result.data };
  const detail = result.error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return { ok: false, message: `invalid ${label}: ${detail}` };
}

/** Read the optional, free-form case evidence the caller attached. */
function readCaseEvidence(body: Record<string, unknown>): CaseEvidence | undefined {
  const raw = body.caseEvidence;
  if (raw === undefined || raw === null) return undefined;
  return raw as CaseEvidence;
}

/* -------------------------------------------------------------------------- */
/* Router factory — clock/idGen are injectable for deterministic tests.        */
/* -------------------------------------------------------------------------- */

export interface GovernanceRouterDeps {
  /** Factory for a FRESH per-request clock. Defaults to {@link RealClock}. */
  createClock?: () => Clock;
  /** Factory for a FRESH per-request id generator. Defaults to {@link SequentialIdGen}. */
  createIdGen?: () => IdGen;
}

export interface GovernanceRouter {
  detect(req: IncomingMessage, res: ServerResponse): Promise<void>;
  enforce(req: IncomingMessage, res: ServerResponse): Promise<void>;
  eval(req: IncomingMessage, res: ServerResponse): Promise<void>;
  loop(req: IncomingMessage, res: ServerResponse): Promise<void>;
  example(req: IncomingMessage, res: ServerResponse): Promise<void>;
}

/** An arbitrary (non-Acme) example payload so callers can see the shape. */
const EXAMPLE_DETECT_BODY = {
  agentOutput: {
    id: "ao_example_p1",
    dealId: "deal_northwind_migration",
    dealName: "Northwind data-platform migration",
    passNumber: 1,
    reportedStatus: "on-track",
    summary: "Migration on track; all services cut over.",
    droppedRequirements: ["PII encryption at rest"],
    agentMetadata: {
      agent: "your-agent",
      model: "your-model",
      artifacts: ["migration-runbook", "service-inventory"],
    },
  },
  caseEvidence: {
    businessImpact: "Regulated PII exposed if shipped uncorrected",
    missingFrom: ["runbook", "cutover checklist"],
    recommendedActions: ["Block cutover until encryption-at-rest is verified"],
  },
} as const;

const EXAMPLE_LOOP_BODY = {
  agentOutputPass1: EXAMPLE_DETECT_BODY.agentOutput,
  agentOutputPass2: {
    ...EXAMPLE_DETECT_BODY.agentOutput,
    id: "ao_example_p2",
    passNumber: 2,
    reportedStatus: "at-risk",
    summary: "Migration corrected; encryption-at-rest requirement honored.",
    droppedRequirements: [],
  },
  caseEvidence: EXAMPLE_DETECT_BODY.caseEvidence,
} as const;

export function createGovernanceRouter(
  deps: GovernanceRouterDeps = {},
): GovernanceRouter {
  const createClock = deps.createClock ?? (() => new RealClock());
  const createIdGen = deps.createIdGen ?? (() => new SequentialIdGen("lim"));

  return {
    /**
     * POST /governance/detect
     * Body: { agentOutput: AgentOutput, caseEvidence?: CaseEvidence }
     * 200 { governanceCase } | 404 (nothing dropped) | 400 (invalid body)
     */
    async detect(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = await readJsonBody(req);
        const parsed = parseAgentOutput(body.agentOutput, "agentOutput");
        if (!parsed.ok) {
          sendJson(res, 400, { error: parsed.message });
          return;
        }
        const agentOutput = parsed.value;
        const caseEvidence = readCaseEvidence(body);

        const source = new InlineAgentOutputSource(
          new Map([[agentOutput.passNumber, agentOutput]]),
        );
        const { caseStore } = createStores();
        const clock = createClock();
        const idGen = createIdGen();

        const governanceCase = await detectMiss(
          source,
          caseStore,
          agentOutput.dealId,
          agentOutput.passNumber,
          clock,
          idGen,
          caseEvidence,
        );

        if (!governanceCase) {
          sendJson(res, 404, {
            error: "no governance case detected (agent output dropped nothing)",
          });
          return;
        }

        sendJson(res, 200, { governanceCase });
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : "Unknown error" });
      }
    },

    /**
     * POST /governance/enforce
     * Body: { governanceCaseId, dealId, currentStatus }
     * 200 { enforcementAction, auditEvent } | 400 (bad input) | 422 (nothing to enforce)
     */
    async enforce(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = await readJsonBody(req);
        const governanceCaseId = body.governanceCaseId;
        const dealId = body.dealId;
        const currentStatusRaw = body.currentStatus ?? body.fromStatus;

        if (typeof governanceCaseId !== "string" || typeof dealId !== "string") {
          sendJson(res, 400, {
            error: "governanceCaseId and dealId are required strings",
          });
          return;
        }
        const statusResult = dealStatus.safeParse(currentStatusRaw);
        if (!statusResult.success) {
          sendJson(res, 400, {
            error: `currentStatus must be one of: ${dealStatus.options.join(", ")}`,
          });
          return;
        }
        const currentStatus: DealStatus = statusResult.data;

        const { auditSink } = createStores();
        const clock = createClock();
        const idGen = createIdGen();

        const { action: enforcementAction, audit: auditEvent } = await enforceCorrection(
          governanceCaseId,
          dealId,
          currentStatus,
          { auditSink, clock, idGen },
        );

        sendJson(res, 200, { enforcementAction, auditEvent });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.includes("nothing to enforce")) {
          sendJson(res, 422, { error: message });
          return;
        }
        sendJson(res, 500, { error: message });
      }
    },

    /**
     * POST /governance/eval
     * Body: { agentOutputPass1, agentOutputPass2, caseEvidence? }
     * Grades both posted passes against the dropped-requirement criterion and
     * returns the persisted EvalTable read back via the eval harness.
     * 200 { evalTable } | 400 (invalid body) | 422 (clean pass 1, nothing to grade)
     */
    async eval(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = await readJsonBody(req);
        const p1 = parseAgentOutput(body.agentOutputPass1, "agentOutputPass1");
        if (!p1.ok) {
          sendJson(res, 400, { error: p1.message });
          return;
        }
        const p2 = parseAgentOutput(body.agentOutputPass2, "agentOutputPass2");
        if (!p2.ok) {
          sendJson(res, 400, { error: p2.message });
          return;
        }
        const caseEvidence = readCaseEvidence(body);

        const source = new InlineAgentOutputSource(
          new Map([
            [1, p1.value],
            [2, p2.value],
          ]),
        );
        const { caseStore, evalStore } = createStores();
        const clock = createClock();
        const idGen = createIdGen();

        const governanceCase = await detectMiss(
          source,
          caseStore,
          p1.value.dealId,
          1,
          clock,
          idGen,
          caseEvidence,
        );
        if (!governanceCase) {
          sendJson(res, 422, {
            error: "pass 1 dropped nothing — there is nothing to grade",
          });
          return;
        }

        await gradeSecondPass(
          { source, evalStore, clock, idGen },
          p1.value.dealId,
          governanceCase,
        );
        const evalTable: EvalTable = await runEvals(evalStore, p1.value.dealId);

        sendJson(res, 200, { evalTable });
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : "Unknown error" });
      }
    },

    /**
     * POST /governance/loop
     * Body: { agentOutputPass1, agentOutputPass2, caseEvidence? }
     * Runs the full loop over the posted passes; returns every artifact produced.
     * 200 { result } | 400 (invalid body) | 422 (clean pass 1, nothing to govern)
     */
    async loop(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = await readJsonBody(req);
        const p1 = parseAgentOutput(body.agentOutputPass1, "agentOutputPass1");
        if (!p1.ok) {
          sendJson(res, 400, { error: p1.message });
          return;
        }
        const p2 = parseAgentOutput(body.agentOutputPass2, "agentOutputPass2");
        if (!p2.ok) {
          sendJson(res, 400, { error: p2.message });
          return;
        }
        const caseEvidence = readCaseEvidence(body);

        const source = new InlineAgentOutputSource(
          new Map([
            [1, p1.value],
            [2, p2.value],
          ]),
        );
        const { caseStore, auditSink, actionGateStore, evalStore } = createStores();
        const clock = createClock();
        const idGen = createIdGen();

        let result: GovernanceLoopResult;
        try {
          result = await runGovernanceLoop(
            {
              source,
              caseStore,
              auditSink,
              actionGateStore,
              evalStore,
              clock,
              idGen,
              caseEvidence,
            },
            p1.value.dealId,
          );
        } catch (loopErr) {
          const message = loopErr instanceof Error ? loopErr.message : "Unknown error";
          if (message.includes("no governance case detected")) {
            sendJson(res, 422, {
              error: "pass 1 dropped nothing — there is nothing to govern",
            });
            return;
          }
          throw loopErr;
        }

        sendJson(res, 200, { result });
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : "Unknown error" });
      }
    },

    /**
     * GET /governance/example
     * Returns ready-to-POST example bodies (arbitrary, non-Acme) so a caller can
     * see the request shape and try the service on a payload of their own.
     */
    async example(_req: IncomingMessage, res: ServerResponse): Promise<void> {
      sendJson(res, 200, {
        detect: EXAMPLE_DETECT_BODY,
        loop: EXAMPLE_LOOP_BODY,
      });
    },
  };
}

/** Default router used by the server: real wall clock + real sequential ids. */
export const governanceRouter: GovernanceRouter = createGovernanceRouter();
