/**
 * POST /governance/* routes that wrap the governance loop phases.
 *
 * Accepts fixture JSON (AgentOutput, CaseEvidence, etc.) and returns contract JSON
 * (GovernanceCase, EnforcementAction, AuditEvent, ActionGate, EvalCase, EvalResult[]).
 *
 * In-memory fixture-backed adapters for all ports (no real Gemini/Linear/persistence).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type AgentOutput,
  agentOutputContract,
  type GovernanceCase,
  type EnforcementAction,
  type AuditEvent,
  type ActionGate,
  type EvalCase,
  type EvalResult,
} from "@liminal-engine/contracts";
import {
  acmeAgentOutputPass1,
  acmeAgentOutputPass2,
  acmeGovernanceCase,
  acmeEnforcementAction,
  acmeAuditEvent,
  acmeBlockedAction,
  acmeEvalCase,
  acmeEvalPass1,
  acmeEvalPass2,
  acmeCaseEvidence,
} from "@liminal-engine/contracts/fixtures";
import {
  runGovernanceLoop,
  type GovernanceCaseStore,
  type AgentOutputSource,
  type AuditSink,
  type ActionGateStore,
  type EvalStore,
  type Clock,
  type IdGen,
  type CaseEvidence,
  type GovernanceLoopResult,
} from "@liminal-engine/governance";
import { runEvals, type EvalTable } from "@liminal-engine/eval-harness";
import { apiState } from "../index.ts";

/**
 * In-memory fixture-backed adapters implementing the governance ports.
 */

class FixtureAgentOutputSource implements AgentOutputSource {
  async getOutput(dealId: string, passNumber: number): Promise<AgentOutput> {
    if (dealId === "deal_acme" && passNumber === 1) {
      return acmeAgentOutputPass1;
    }
    if (dealId === "deal_acme" && passNumber === 2) {
      return acmeAgentOutputPass2;
    }
    throw new Error(`Unknown deal ${dealId}, pass ${passNumber}`);
  }
}

class InMemoryGovernanceCaseStore implements GovernanceCaseStore {
  async open(governanceCase: GovernanceCase): Promise<void> {
    apiState.governanceCases.set(governanceCase.id, governanceCase);
  }

  async correct(caseId: string): Promise<void> {
    const gc = apiState.governanceCases.get(caseId);
    if (gc) {
      gc.status = "corrected";
      apiState.governanceCases.set(caseId, gc);
    }
  }

  async byDeal(dealId: string): Promise<GovernanceCase[]> {
    const cases = Array.from(apiState.governanceCases.values()).filter(
      (gc) => gc.dealId === dealId
    );
    return cases;
  }
}

class InMemoryAuditSink implements AuditSink {
  async record(event: AuditEvent): Promise<void> {
    apiState.auditEvents.set(event.id, event);
  }

  async all(): Promise<AuditEvent[]> {
    return Array.from(apiState.auditEvents.values());
  }
}

class InMemoryActionGateStore implements ActionGateStore {
  async gate(gate: ActionGate): Promise<void> {
    apiState.actionGates.set(gate.action, gate);
  }

  async decisionFor(action: string): Promise<any> {
    const gate = apiState.actionGates.get(action);
    if (!gate) return { allowed: true, reasons: [], requiredBeforeSend: [] };
    return {
      allowed: gate.verdict === "allow",
      reasons: gate.reasons,
      requiredBeforeSend: gate.requiredBeforeSend,
    };
  }
}

class InMemoryEvalStore implements EvalStore {
  async record(result: EvalResult): Promise<void> {
    const key = `${result.dealId}:${result.criterion}:${result.passNumber}`;
    apiState.evalResults.set(key, result);
  }

  async byDeal(dealId: string): Promise<EvalResult[]> {
    const results = Array.from(apiState.evalResults.values()).filter(
      (er) => er.dealId === dealId
    );
    return results;
  }
}

/**
 * Deterministic Clock/IdGen for reproducible demo results.
 * All timestamps and IDs are hardcoded to match the Acme fixtures.
 */
class DemoClock implements Clock {
  private callCount = 0;
  now(): string {
    // Return fixed timestamps matching the fixture
    return "2026-06-27T10:00:00.000Z";
  }
}

class DemoIdGen implements IdGen {
  private callCount = 0;
  private mapping: Map<number, string> = new Map();
  // Map sequence to fixture IDs so the API returns the same IDs as the fixtures
  private sequence = [
    "gc_acme_eu", // governanceCase
    "ea_acme_enforce", // enforcementAction
    "ae_acme_audit", // auditEvent
    "ag_acme_blocked", // actionGate
    "ec_acme_evals", // evalCase
  ];

  next(): string {
    const id = this.sequence[this.callCount] || `id_${this.callCount}`;
    this.callCount++;
    return id;
  }
}

// Singleton instances for request handling
const agentOutputSource = new FixtureAgentOutputSource();
const governanceCaseStore = new InMemoryGovernanceCaseStore();
const auditSink = new InMemoryAuditSink();
const actionGateStore = new InMemoryActionGateStore();
const evalStore = new InMemoryEvalStore();
const clock = new DemoClock();
const idGen = new DemoIdGen();

/**
 * Reads a JSON body from the request.
 */
async function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const data = body ? JSON.parse(body) : {};
        resolve(data);
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Sends a JSON response.
 */
function sendJson(res: ServerResponse, status: number, data: any): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

export const governanceRouter = {
  /**
   * POST /governance/detect
   * Request: { dealId: string, passNumber?: number, caseEvidence?: CaseEvidence }
   * Response: { governanceCase: GovernanceCase }
   */
  async detect(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req);
      const { dealId, passNumber = 1, caseEvidence } = body;

      if (!dealId) {
        sendJson(res, 400, { error: "dealId is required" });
        return;
      }

      const { detectMiss } = await import("@liminal-engine/governance");
      const governanceCase = await detectMiss(
        agentOutputSource,
        governanceCaseStore,
        dealId,
        passNumber,
        clock,
        idGen,
        caseEvidence
      );

      if (!governanceCase) {
        sendJson(res, 404, { error: "No governance case detected" });
        return;
      }

      sendJson(res, 200, { governanceCase });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      sendJson(res, 500, { error: message });
    }
  },

  /**
   * POST /governance/enforce
   * Request: { governanceCaseId: string, dealId: string, newStatus?: string }
   * Response: { enforcementAction: EnforcementAction, auditEvent: AuditEvent }
   */
  async enforce(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req);
      const { governanceCaseId, dealId, newStatus = "at-risk" } = body;

      if (!governanceCaseId || !dealId) {
        sendJson(res, 400, { error: "governanceCaseId and dealId are required" });
        return;
      }

      const { enforceCorrection } = await import("@liminal-engine/governance");
      const { action: enforcementAction, audit: auditEvent } = await enforceCorrection(
        governanceCaseId,
        dealId,
        newStatus,
        { auditSink, clock, idGen }
      );

      sendJson(res, 200, { enforcementAction, auditEvent });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      sendJson(res, 500, { error: message });
    }
  },

  /**
   * POST /governance/eval
   * Request: { dealId: string }
   * Response: { evalTable: EvalResult[] }
   */
  async eval(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req);
      const { dealId } = body;

      if (!dealId) {
        sendJson(res, 400, { error: "dealId is required" });
        return;
      }

      const evalTable: EvalTable = await runEvals(evalStore, dealId);
      sendJson(res, 200, { evalTable });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      sendJson(res, 500, { error: message });
    }
  },

  /**
   * POST /governance/loop
   * Request: { dealId: string, caseEvidence?: CaseEvidence }
   * Response: { result: GovernanceLoopResult }
   *
   * Runs the full governance loop (observe → detect → correct → enforce → audit → improve).
   */
  async loop(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req);
      const { dealId, caseEvidence } = body;

      if (!dealId) {
        sendJson(res, 400, { error: "dealId is required" });
        return;
      }

      const result: GovernanceLoopResult = await runGovernanceLoop(
        {
          source: agentOutputSource,
          caseStore: governanceCaseStore,
          auditSink,
          actionGateStore,
          evalStore,
          clock,
          idGen,
          caseEvidence,
        },
        dealId
      );

      sendJson(res, 200, { result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      sendJson(res, 500, { error: message });
    }
  },
};
