/**
 * Integration tests for the Liminal Engine API server.
 *
 * Real tests with real fixtures + logic, no mocks or fake responses.
 * Tests that each endpoint accepts contract JSON and returns contract JSON.
 */
import test from "node:test";
import assert from "node:assert";
import { createServer, request as httpRequest } from "node:http";
import type { Server } from "node:http";
import { apiState } from "../src/index.ts";
import { governanceRouter } from "../src/routes/governance.ts";
import type {
  GovernanceCase,
  EnforcementAction,
  AuditEvent,
  ActionGate,
  EvalResult,
} from "@liminal-engine/contracts";

/**
 * HTTP test helper — makes POST/GET requests to an endpoint.
 */
async function makeRequest(
  port: number,
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "localhost",
        port,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode || 500, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 500, body: data });
          }
        });
      }
    );

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test("Liminal Engine API", async (t) => {
  // Start test server (use port 0 to let OS assign; closes properly with no cleanup issues)
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");

    if (req.method === "POST" && url.pathname === "/governance/detect") {
      return governanceRouter.detect(req, res);
    }
    if (req.method === "POST" && url.pathname === "/governance/enforce") {
      return governanceRouter.enforce(req, res);
    }
    if (req.method === "POST" && url.pathname === "/governance/eval") {
      return governanceRouter.eval(req, res);
    }
    if (req.method === "POST" && url.pathname === "/governance/loop") {
      return governanceRouter.loop(req, res);
    }
    if (req.method === "GET" && url.pathname === "/health") {
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

  await t.test("GET /health returns ok", async () => {
    const { status, body } = await makeRequest(port, "GET", "/health");
    assert.equal(status, 200);
    assert.deepEqual(body, { status: "ok" });
  });

  await t.test("POST /governance/detect with valid deal returns GovernanceCase", async () => {
    // Clear state
    apiState.governanceCases.clear();
    apiState.auditEvents.clear();
    apiState.actionGates.clear();
    apiState.evalResults.clear();

    const { status, body } = await makeRequest(port, "POST", "/governance/detect", {
      dealId: "deal_acme",
      passNumber: 1,
    });

    assert.equal(status, 200);
    assert(body.governanceCase);
    assert.equal(body.governanceCase.dealId, "deal_acme");
    assert.equal(body.governanceCase.missedRequirement, "EU data residency");
    assert.equal(body.governanceCase.status, "open");
  });

  await t.test("POST /governance/detect with evidence includes case enrichment", async () => {
    apiState.governanceCases.clear();

    const { status, body } = await makeRequest(port, "POST", "/governance/detect", {
      dealId: "deal_acme",
      passNumber: 1,
      caseEvidence: {
        businessImpact: "$1.2M Acme expansion at risk",
        missingFrom: ["proposal", "launch plan"],
        recommendedActions: ["Block customer-facing update"],
      },
    });

    assert.equal(status, 200);
    assert(body.governanceCase);
    assert.equal(body.governanceCase.businessImpact, "$1.2M Acme expansion at risk");
    assert.deepEqual(body.governanceCase.missingFrom, ["proposal", "launch plan"]);
  });

  await t.test("POST /governance/detect missing dealId returns 400", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/detect", {});
    assert.equal(status, 400);
    assert(body.error);
  });

  await t.test("POST /governance/enforce with valid case returns EnforcementAction + AuditEvent", async () => {
    // Test enforcement in isolation by clearing state first
    apiState.governanceCases.clear();
    apiState.auditEvents.clear();
    apiState.actionGates.clear();
    apiState.evalResults.clear();

    // Detect to create a case
    const detectRes = await makeRequest(port, "POST", "/governance/detect", {
      dealId: "deal_acme",
      passNumber: 1,
    });

    assert.equal(detectRes.status, 200);
    const caseId = detectRes.body.governanceCase.id;

    // Then enforce with the correct status from the fixture
    const { status, body } = await makeRequest(port, "POST", "/governance/enforce", {
      governanceCaseId: caseId,
      dealId: "deal_acme",
      newStatus: "on-track",  // This is the current status from pass 1
    });

    assert.equal(status, 200, `Expected 200 but got ${status}: ${JSON.stringify(body)}`);
    assert(body.enforcementAction);
    assert(body.auditEvent);
    assert.equal(body.enforcementAction.fromStatus, "on-track");
    assert.equal(body.enforcementAction.toStatus, "at-risk");
    assert.equal(body.auditEvent.action, "correction-enforced");
  });

  await t.test("POST /governance/loop runs full loop and returns all artifacts", async () => {
    // Clear state
    apiState.governanceCases.clear();
    apiState.auditEvents.clear();
    apiState.actionGates.clear();
    apiState.evalResults.clear();

    const { status, body } = await makeRequest(port, "POST", "/governance/loop", {
      dealId: "deal_acme",
    });

    assert.equal(status, 200);
    const { result } = body;
    assert(result.governanceCase);
    assert(result.enforcementAction);
    assert(result.auditEvent);
    assert(result.gate);
    assert(result.evalCase);
    assert(Array.isArray(result.evals));

    // Verify the loop produced the expected artifacts for the Acme case
    assert.equal(result.governanceCase.dealId, "deal_acme");
    assert.equal(result.governanceCase.missedRequirement, "EU data residency");
    assert.equal(result.enforcementAction.toStatus, "at-risk");
    assert.equal(result.gate.verdict, "deny");
    assert.equal(result.evalCase.dealId, "deal_acme");
    assert(result.evals.length > 0);
  });

  await t.test("POST /governance/eval returns eval table for deal", async () => {
    // State already populated by the loop test
    // Now fetch evals
    const { status, body } = await makeRequest(port, "POST", "/governance/eval", {
      dealId: "deal_acme",
    });

    assert.equal(status, 200);
    assert(Array.isArray(body.evalTable));
    // The Acme fixture should have 2 eval results (pass 1 fail, pass 2 pass)
    assert(body.evalTable.length >= 2);
    const pass1 = body.evalTable.find((e: any) => e.passNumber === 1);
    const pass2 = body.evalTable.find((e: any) => e.passNumber === 2);
    assert.equal(pass1?.result, "fail");
    assert.equal(pass2?.result, "pass");
  });

  await t.test("POST /governance/loop with missing dealId returns 400", async () => {
    const { status, body } = await makeRequest(port, "POST", "/governance/loop", {});
    assert.equal(status, 400);
    assert(body.error);
  });

  // Close server synchronously without waiting
  // Avoids the Node.js test runner's hanging socket detection
  // The process exit will clean up any remaining resources
  server.close();
  server.closeAllConnections?.();  // Node.js 18.2.0+
});
