/**
 * Offline tests for POST /livekit/token — the SERVER-SIDE token endpoint.
 *
 * No network and no real SDK call: hasConfig + mintToken are injected so we can
 * assert the endpoint's contract deterministically —
 *   - creds absent → HTTP 503 (NO scripted fallback),
 *   - creds present → 200 { token, url } minted from the posted room/identity,
 *   - the mint receives the correct grants (roomJoin / room / canPublish), proven
 *     by routing the injected mintToken through the real mintLiveKitToken with a
 *     MOCKED AccessToken.
 * Real assertions, no `.skip`, no `.todo`.
 */
import test from "node:test";
import assert from "node:assert";
import { createServer, request as httpRequest } from "node:http";
import type { IncomingMessage, ServerResponse, Server } from "node:http";
import { createLiveKitRouter } from "../src/routes/livekit.ts";
import {
  mintLiveKitToken,
  type AccessTokenCtor,
  type AccessTokenVideoGrant,
  type LiveKitConfig,
} from "@liminal-engine/integration-livekit";

const TEST_CONFIG: LiveKitConfig = {
  url: "wss://test.livekit.cloud",
  apiKey: "APItestkey",
  apiSecret: "test-secret-0123456789-0123456789",
};

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

async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ port: number; close: () => void }> {
  const server: Server = createServer(handler);
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

test("POST /livekit/token", async (t) => {
  await t.test("503 when LiveKit is not configured (no scripted fallback)", async () => {
    const router = createLiveKitRouter({ hasConfig: () => false });
    const srv = await startServer((req, res) => router.token(req, res));
    try {
      const { status, body } = await makeRequest(srv.port, "POST", "/livekit/token", {
        room: "correction-room",
        identity: "operator-1",
      });
      assert.strictEqual(status, 503);
      assert.ok(typeof body.error === "string" && body.error.length > 0);
      // Must NOT leak a token or a fabricated transcript on the unconfigured path.
      assert.strictEqual(body.token, undefined);
      assert.strictEqual(body.transcript, undefined);
    } finally {
      srv.close();
    }
  });

  await t.test("200 mints a token from the posted room/identity, scoped correctly", async () => {
    // Capture what the real mint asks the (mocked) AccessToken to grant.
    const captured: { grant?: AccessTokenVideoGrant; identity?: string } = {};
    class FakeAccessToken {
      constructor(_apiKey: string, _apiSecret: string, options?: { identity?: string }) {
        captured.identity = options?.identity;
      }
      addGrant(grant: AccessTokenVideoGrant): void {
        captured.grant = grant;
      }
      async toJwt(): Promise<string> {
        return "header.payload.signature";
      }
    }
    const FakeCtor: AccessTokenCtor = FakeAccessToken;

    const router = createLiveKitRouter({
      hasConfig: () => true,
      mintToken: (params) =>
        mintLiveKitToken(params, { config: TEST_CONFIG, accessTokenCtor: FakeCtor }),
    });
    const srv = await startServer((req, res) => router.token(req, res));
    try {
      const { status, body } = await makeRequest(srv.port, "POST", "/livekit/token", {
        room: "correction-room",
        identity: "operator-42",
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(body.token, "header.payload.signature");
      assert.strictEqual(body.url, TEST_CONFIG.url);
      assert.strictEqual(body.room, "correction-room");
      assert.strictEqual(body.identity, "operator-42");

      // The endpoint must request a join+publish grant scoped to the posted room.
      assert.strictEqual(captured.identity, "operator-42");
      assert.strictEqual(captured.grant?.roomJoin, true);
      assert.strictEqual(captured.grant?.room, "correction-room");
      assert.strictEqual(captured.grant?.canPublish, true);
    } finally {
      srv.close();
    }
  });

  await t.test("defaults room/identity when the body omits them", async () => {
    const router = createLiveKitRouter({
      hasConfig: () => true,
      mintToken: async () => ({ token: "t.t.t", url: TEST_CONFIG.url }),
    });
    const srv = await startServer((req, res) => router.token(req, res));
    try {
      const { status, body } = await makeRequest(srv.port, "POST", "/livekit/token", {});
      assert.strictEqual(status, 200);
      assert.strictEqual(body.room, "correction-room");
      assert.ok(typeof body.identity === "string" && body.identity.startsWith("operator-"));
    } finally {
      srv.close();
    }
  });
});
