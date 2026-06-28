/**
 * Integration tests for the Liminal Engine API server.
 *
 * The service governs ARBITRARY posted agent output — there is no hardcoded
 * fixture lookup and no fixed sequence. These tests prove that:
 *   - any caller's AgentOutput (validated against the contract) is detected/looped,
 *   - the produced artifacts are keyed off the POSTED data (not Acme),
 *   - ids/timestamps are generated (not the hardcoded Acme ids), and
 *   - a second, different payload works just as well.
 *
 * Determinism is injected: the test router is built with a fixed clock + a
 * fixed-prefix id generator so id/timestamp assertions are stable. A separate
 * test exercises the REAL defaults (RealClock + SequentialIdGen) to prove the
 * production path emits real ids/timestamps, never the Acme constants.
 *
 * Real tests with real logic — no mocks, no `.skip`, no `.todo`.
 */
import test from "node:test";
import assert from "node:assert";
import { createServer, request as httpRequest } from "node:http";
import type { IncomingMessage, ServerResponse, Server } from "node:http";
import {
  createGovernanceRouter,
  governanceRouter,
  SequentialIdGen,
  type GovernanceRouter,
} from "../src/routes/governance.ts";
import type { Clock } from "@liminal-engine/governance";

/** A constant-time clock so detectedAt/enforcedAt/etc. are deterministic in tests. */
const FIXED_NOW = "2030-01-01T00:00:00.000Z";
class FixedClock implements Clock {
  now(): string {
    return FIXED_NOW;
  }
}

/** The Acme constants the service must NEVER emit for arbitrary data. */
const ACME_CASE_ID = "gc_acme_eu";
const ACME_NOW = "2026-06-27T10:00:00.000Z";

/** HTTP test helper — makes POST/GET requests to an endpoint. */
async function makeRequest(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "localhost",
        port,
        path,
        method,
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode || 500, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode || 500, body: data });
          }
        });
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

/** Start a server that routes every governance path to the given router. */
async function startServer(
  router: GovernanceRouter,
): Promise<{ port: number; close: () => void }> {
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", "http://localhost");
    const { pathname } = url;
    if (req.method === "POST" && pathname === "/governance/detect") return router.detect(req, res);
    if (req.method === "POST" && pathname === "/governance/enforce") return router.enforce(req, res);
    if (req.method === "POST" && pathname === "/governance/eval") return router.eval(req, res);
    if (req.method === "POST" && pathname === "/governance/loop") return router.loop(req, res);
    if (req.method === "GET" && pathname === "/governance/example") return router.example(req, res);
    if (req.method === "GET" && pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const port = await new Promise<number>((resolve) => {
    server.listen(0, "localhost", () => {
      const addr = server.address();
      resolve(typeof addr === "object" && addr ? addr.port : 3000);
    });
  });
  return {
    port,
    close: () => {
      server.close();
      server.closeAllConnections?.();
    },
  };
}

// A valid AgentOutput for an ARBITRARY subject (not Acme) that dropped a requirement.
function arbitraryDroppedOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: "ao_zenpay_p1",
    dealId: "deal_zenpay",
    dealName: "ZenPay onboarding",
    passNumber: 1,
    reportedStatus: "on-track",
    summary: "ZenPay onboarding on track; all checks green.",
    droppedRequirements: ["GDPR consent"],
    agentMetadata: {
      agent: "your-agent",
      model: "your-model",
      artifacts: ["onboarding-checklist"],
    },
    ...overrides,
  };
}

test("Liminal Engine API — arbitrary agent-output governance", async (t) => {
  // Deterministic router: fixed clock + fixed-prefix ids → stable assertions.
  const deterministic = await startServer(
    createGovernanceRouter({
      createClock: () => new FixedClock(),
      createIdGen: () => new SequentialIdGen("test"),
    }),
  );
  // Real-defaults router: RealClock + SequentialIdGen("lim") → real ids/timestamps.
  const defaults = await startServer(governanceRouter);
  const port = deterministic.port;

  await t.test("GET /health returns ok", async () => {
    const { status, body } = await makeRequest(port, "GET", "/health");
    assert.equal(status, 200);
    assert.deepEqual(body, { status: "ok" });
  });

  await t.test("POST /governance/detect with an arbitrary dropped requirement → 200", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/detect", {
      agentOutput: arbitraryDroppedOutput(),
    });

    assert.equal(status, 200);
    assert(body.governanceCase, "expected a governanceCase");
    // Keyed off the POSTED data, not Acme.
    assert.equal(body.governanceCase.dealId, "deal_zenpay");
    assert.equal(body.governanceCase.missedRequirement, "GDPR consent");
    assert.equal(body.governanceCase.status, "open");
    // A generated id + timestamp — NOT the hardcoded Acme constants.
    assert.equal(body.governanceCase.id, "test-1");
    assert.notEqual(body.governanceCase.id, ACME_CASE_ID);
    assert.equal(body.governanceCase.detectedAt, FIXED_NOW);
    assert.notEqual(body.governanceCase.detectedAt, ACME_NOW);
  });

  await t.test("POST /governance/detect with caseEvidence enriches the case", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/detect", {
      agentOutput: arbitraryDroppedOutput(),
      caseEvidence: {
        businessImpact: "EU users blocked at onboarding",
        missingFrom: ["onboarding flow", "privacy notice"],
        recommendedActions: ["Block go-live until consent capture ships"],
      },
    });

    assert.equal(status, 200);
    assert.equal(body.governanceCase.businessImpact, "EU users blocked at onboarding");
    assert.deepEqual(body.governanceCase.missingFrom, ["onboarding flow", "privacy notice"]);
    assert.deepEqual(body.governanceCase.recommendedActions, [
      "Block go-live until consent capture ships",
    ]);
  });

  await t.test("POST /governance/detect with a CLEAN agent output → 404", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/detect", {
      agentOutput: arbitraryDroppedOutput({ droppedRequirements: [] }),
    });
    assert.equal(status, 404);
    assert(body.error, "expected an error message");
  });

  await t.test("POST /governance/detect with an invalid body → 400", async () => {
    // Missing required fields (dealName, passNumber, summary, ...).
    const { status, body } = await makeRequest(port, "POST", "/governance/detect", {
      agentOutput: { id: "x", dealId: "deal_zenpay" },
    });
    assert.equal(status, 400);
    assert(typeof body.error === "string" && body.error.includes("invalid agentOutput"));
  });

  await t.test("POST /governance/detect with no agentOutput → 400", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/detect", {});
    assert.equal(status, 400);
    assert(body.error);
  });

  await t.test("POST /governance/loop with two arbitrary passes → 200 full result", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/loop", {
      agentOutputPass1: arbitraryDroppedOutput(),
      agentOutputPass2: arbitraryDroppedOutput({
        id: "ao_zenpay_p2",
        passNumber: 2,
        reportedStatus: "at-risk",
        summary: "ZenPay onboarding corrected; GDPR consent honored.",
        droppedRequirements: [],
      }),
      caseEvidence: { businessImpact: "EU users blocked at onboarding" },
    });

    assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
    const { result } = body;
    assert(result.governanceCase, "governanceCase");
    assert(result.enforcementAction, "enforcementAction");
    assert(result.auditEvent, "auditEvent");
    assert(result.gate, "gate");
    assert(result.evalCase, "evalCase");
    assert(Array.isArray(result.evals), "evals");

    // Every artifact is keyed off the POSTED subject (deal_zenpay), not Acme.
    assert.equal(result.governanceCase.dealId, "deal_zenpay");
    assert.equal(result.governanceCase.missedRequirement, "GDPR consent");
    assert.equal(result.governanceCase.businessImpact, "EU users blocked at onboarding");
    assert.equal(result.enforcementAction.dealId, "deal_zenpay");
    assert.equal(result.enforcementAction.toStatus, "at-risk");
    assert.equal(result.auditEvent.dealId, "deal_zenpay");
    assert.equal(result.auditEvent.action, "correction-enforced");
    assert.equal(result.gate.verdict, "deny");
    assert.equal(result.evalCase.dealId, "deal_zenpay");
    assert.equal(result.evalCase.criterion, "GDPR consent requirement honored");

    // Fail (pass 1, still dropped) → Pass (pass 2, corrected).
    const pass1 = result.evals.find((e: any) => e.passNumber === 1);
    const pass2 = result.evals.find((e: any) => e.passNumber === 2);
    assert.equal(pass1?.result, "fail");
    assert.equal(pass2?.result, "pass");

    // Generated, non-Acme id for the case.
    assert.equal(result.governanceCase.id, "test-1");
    assert.notEqual(result.governanceCase.id, ACME_CASE_ID);
  });

  await t.test("POST /governance/loop with a SECOND, DIFFERENT subject also works", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/loop", {
      agentOutputPass1: {
        id: "ao_helios_p1",
        dealId: "deal_helios",
        dealName: "Helios platform launch",
        passNumber: 1,
        reportedStatus: "on-track",
        summary: "Helios launch on track.",
        droppedRequirements: ["SOC2 audit log retention"],
      },
      agentOutputPass2: {
        id: "ao_helios_p2",
        dealId: "deal_helios",
        dealName: "Helios platform launch",
        passNumber: 2,
        reportedStatus: "at-risk",
        summary: "Helios launch corrected; retention honored.",
        droppedRequirements: [],
      },
    });

    assert.equal(status, 200);
    const { result } = body;
    // Proves the service is not hardcoded to one subject/requirement.
    assert.equal(result.governanceCase.dealId, "deal_helios");
    assert.equal(result.governanceCase.missedRequirement, "SOC2 audit log retention");
    assert.equal(result.evalCase.criterion, "SOC2 audit log retention requirement honored");
    assert.equal(result.evals.find((e: any) => e.passNumber === 1)?.result, "fail");
    assert.equal(result.evals.find((e: any) => e.passNumber === 2)?.result, "pass");
  });

  await t.test("POST /governance/loop with a CLEAN pass 1 → 422 (nothing to govern)", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/loop", {
      agentOutputPass1: arbitraryDroppedOutput({ droppedRequirements: [] }),
      agentOutputPass2: arbitraryDroppedOutput({
        id: "ao_zenpay_p2",
        passNumber: 2,
        droppedRequirements: [],
      }),
    });
    assert.equal(status, 422);
    assert(body.error);
  });

  await t.test("POST /governance/loop with an invalid pass → 400", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/loop", {
      agentOutputPass1: { id: "x" },
      agentOutputPass2: arbitraryDroppedOutput(),
    });
    assert.equal(status, 400);
    assert(body.error.includes("invalid agentOutputPass1"));
  });

  await t.test("POST /governance/enforce returns EnforcementAction + AuditEvent", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/enforce", {
      governanceCaseId: "test-1",
      dealId: "deal_zenpay",
      currentStatus: "on-track",
    });

    assert.equal(status, 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body.enforcementAction.dealId, "deal_zenpay");
    assert.equal(body.enforcementAction.fromStatus, "on-track");
    assert.equal(body.enforcementAction.toStatus, "at-risk");
    assert.equal(body.auditEvent.action, "correction-enforced");
  });

  await t.test("POST /governance/enforce with nothing to enforce → 422", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/enforce", {
      governanceCaseId: "test-1",
      dealId: "deal_zenpay",
      currentStatus: "at-risk",
    });
    assert.equal(status, 422);
    assert(body.error.includes("nothing to enforce"));
  });

  await t.test("POST /governance/enforce with a bad status → 400", async () => {
    const { status } = await makeRequest(port, "POST", "/governance/enforce", {
      governanceCaseId: "test-1",
      dealId: "deal_zenpay",
      currentStatus: "sideways",
    });
    assert.equal(status, 400);
  });

  await t.test("POST /governance/eval grades both posted passes (Fail → Pass)", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/eval", {
      agentOutputPass1: arbitraryDroppedOutput(),
      agentOutputPass2: arbitraryDroppedOutput({
        id: "ao_zenpay_p2",
        passNumber: 2,
        droppedRequirements: [],
      }),
    });

    assert.equal(status, 200);
    assert(Array.isArray(body.evalTable));
    assert.equal(body.evalTable.length, 2);
    assert.equal(body.evalTable.find((e: any) => e.passNumber === 1)?.result, "fail");
    assert.equal(body.evalTable.find((e: any) => e.passNumber === 2)?.result, "pass");
  });

  await t.test("GET /governance/example returns ready-to-POST bodies", async () => {
    const { status, body } = await makeRequest(port, "GET", "/governance/example");
    assert.equal(status, 200);
    assert(body.detect?.agentOutput, "example detect body");
    assert(body.loop?.agentOutputPass1, "example loop pass 1");
    assert(body.loop?.agentOutputPass2, "example loop pass 2");
  });

  await t.test("default router emits REAL generated ids + timestamps (not Acme)", async () => {
    const { status, body } = await makeRequest(defaults.port, "POST", "/governance/detect", {
      agentOutput: arbitraryDroppedOutput(),
    });

    assert.equal(status, 200);
    // Real SequentialIdGen → `lim-<n>`, never the Acme id.
    assert.match(body.governanceCase.id, /^lim-\d+$/);
    assert.notEqual(body.governanceCase.id, ACME_CASE_ID);
    // RealClock → a parseable ISO timestamp, not the frozen Acme constant.
    const detectedAt = body.governanceCase.detectedAt;
    assert.equal(new Date(detectedAt).toISOString(), detectedAt);
    assert.notEqual(detectedAt, ACME_NOW);
  });

  deterministic.close();
  defaults.close();
});
