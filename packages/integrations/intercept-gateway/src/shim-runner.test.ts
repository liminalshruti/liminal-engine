import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { runShim } from "./shim-runner.ts";

test("runShim fails closed when consequential actions lack injected deterministic id/time", async () => {
  const oldId = process.env["LIMINAL_ACTION_ID"];
  const oldRequestedAt = process.env["LIMINAL_REQUESTED_AT"];
  const oldGateway = process.env["LIMINAL_POLICY_GATEWAY_URL"];
  delete process.env["LIMINAL_ACTION_ID"];
  delete process.env["LIMINAL_REQUESTED_AT"];
  process.env["LIMINAL_POLICY_GATEWAY_URL"] = "http://127.0.0.1:9/intercept";

  try {
    assert.equal(await runShim("git", ["push", "--force"]), 2);
  } finally {
    restoreEnv("LIMINAL_ACTION_ID", oldId);
    restoreEnv("LIMINAL_REQUESTED_AT", oldRequestedAt);
    restoreEnv("LIMINAL_POLICY_GATEWAY_URL", oldGateway);
  }
});

test("runShim reports command outcome after an allowed consequential action executes", async () => {
  const oldEnv = snapshotEnv([
    "LIMINAL_ACTION_ID",
    "LIMINAL_REQUESTED_AT",
    "LIMINAL_COMPLETED_AT",
    "LIMINAL_POLICY_GATEWAY_URL",
    "LIMINAL_REAL_GIT",
  ]);
  let intercepted: unknown;
  let outcome: unknown;
  const server = createServer((req, res) => {
    void (async () => {
      const body = await readJson(req);
      if (req.url === "/intercept") {
        intercepted = body;
        sendJson(res, { allowed: true, verdict: "allow", reasons: [] });
        return;
      }
      if (req.url === "/outcome") {
        outcome = body;
        sendJson(res, { ok: true });
        return;
      }
      res.writeHead(404);
      res.end();
    })();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  process.env["LIMINAL_ACTION_ID"] = "ia_force_push";
  process.env["LIMINAL_REQUESTED_AT"] = "2026-06-27T20:00:00.000Z";
  process.env["LIMINAL_COMPLETED_AT"] = "2026-06-27T20:00:01.000Z";
  process.env["LIMINAL_POLICY_GATEWAY_URL"] = `http://127.0.0.1:${port}/intercept`;
  process.env["LIMINAL_REAL_GIT"] = "/usr/bin/true";

  try {
    assert.equal(await runShim("git", ["push", "--force"]), 0);
    assert.equal((intercepted as { id: string }).id, "ia_force_push");
    assert.deepEqual(outcome, {
      actionId: "ia_force_push",
      exitCode: 0,
      completedAt: "2026-06-27T20:00:01.000Z",
    });
  } finally {
    server.close();
    await once(server, "close");
    restoreSnapshot(oldEnv);
  }
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function snapshotEnv(keys: readonly string[]): Record<string, string | undefined> {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreSnapshot(snapshot: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    restoreEnv(key, value);
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length === 0 ? {} : JSON.parse(raw);
}

function sendJson(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
