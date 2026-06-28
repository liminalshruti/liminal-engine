/**
 * Offline tests for the SERVER-ONLY LiveKit token mint.
 *
 * No live calls and no network: livekit-server-sdk's AccessToken is exercised in
 * two ways —
 *   1. injected FAKE AccessToken (mock) → assert mintLiveKitToken requests the
 *      correct video grant (roomJoin / room / canPublish) and returns the JWT,
 *   2. REAL AccessToken with an injected test config → decode the produced JWT and
 *      assert it is a genuine token carrying those same grants.
 * Plus the credential-fallback behavior (no creds → throws; the endpoint maps
 * that to HTTP 503). Every test asserts something. 0 skipped.
 */
import { test } from "node:test";
import assert from "node:assert";
import {
  getLiveKitConfig,
  hasLiveKitConfig,
  mintLiveKitToken,
  type AccessTokenCtor,
  type AccessTokenVideoGrant,
  type LiveKitConfig,
} from "./index.ts";

const TEST_CONFIG: LiveKitConfig = {
  url: "wss://test.livekit.cloud",
  apiKey: "APItestkey",
  apiSecret: "test-secret-0123456789-0123456789",
};

/** Captures what mintLiveKitToken does to a (fake) AccessToken — no SDK, no network. */
function makeFakeAccessToken(): {
  Ctor: AccessTokenCtor;
  calls: {
    ctorArgs?: [string, string, { identity?: string } | undefined];
    grant?: AccessTokenVideoGrant;
    toJwtCalled: boolean;
  };
} {
  const calls = { toJwtCalled: false } as {
    ctorArgs?: [string, string, { identity?: string } | undefined];
    grant?: AccessTokenVideoGrant;
    toJwtCalled: boolean;
  };

  class FakeAccessToken {
    constructor(
      apiKey: string,
      apiSecret: string,
      options?: { identity?: string },
    ) {
      calls.ctorArgs = [apiKey, apiSecret, options];
    }
    addGrant(grant: AccessTokenVideoGrant): void {
      calls.grant = grant;
    }
    async toJwt(): Promise<string> {
      calls.toJwtCalled = true;
      // A JWT-shaped value (header.payload.signature) — proves pass-through.
      return "header.payload.signature";
    }
  }

  return { Ctor: FakeAccessToken, calls };
}

test("mintLiveKitToken: mints with the correct grants using a MOCKED AccessToken", async () => {
  const { Ctor, calls } = makeFakeAccessToken();

  const result = await mintLiveKitToken(
    { room: "correction-room", identity: "operator-42" },
    { config: TEST_CONFIG, accessTokenCtor: Ctor },
  );

  // Constructed with the SERVER api key/secret + the requested identity.
  assert.deepStrictEqual(calls.ctorArgs, [
    TEST_CONFIG.apiKey,
    TEST_CONFIG.apiSecret,
    { identity: "operator-42" },
  ]);

  // The grant must let the browser JOIN the named room and PUBLISH its mic.
  assert.ok(calls.grant, "addGrant was called");
  assert.strictEqual(calls.grant?.roomJoin, true, "roomJoin granted");
  assert.strictEqual(calls.grant?.room, "correction-room", "scoped to the room");
  assert.strictEqual(calls.grant?.canPublish, true, "canPublish granted");
  assert.strictEqual(calls.grant?.canSubscribe, true, "canSubscribe granted");

  assert.strictEqual(calls.toJwtCalled, true, "toJwt() was awaited");
  // Returns the signed JWT + the LiveKit server URL the browser connects to.
  assert.strictEqual(result.token, "header.payload.signature");
  assert.strictEqual(result.url, TEST_CONFIG.url);
});

test("mintLiveKitToken: produces a REAL JWT whose decoded grants match", async () => {
  // Uses the genuine livekit-server-sdk AccessToken (offline crypto, no network).
  const { token, url } = await mintLiveKitToken(
    { room: "lim-1260-room", identity: "operator-real" },
    { config: TEST_CONFIG },
  );

  assert.strictEqual(url, TEST_CONFIG.url);

  // A JWT is three base64url segments: header.payload.signature.
  const segments = token.split(".");
  assert.strictEqual(segments.length, 3, "token has 3 JWT segments");
  const payloadSegment = segments[1];
  assert.ok(payloadSegment, "JWT has a payload segment");

  const payload = JSON.parse(
    Buffer.from(payloadSegment, "base64url").toString("utf8"),
  ) as { sub?: string; video?: AccessTokenVideoGrant };

  assert.strictEqual(payload.sub, "operator-real", "identity is the JWT subject");
  assert.ok(payload.video, "JWT carries a video grant");
  assert.strictEqual(payload.video?.roomJoin, true, "roomJoin granted");
  assert.strictEqual(payload.video?.room, "lim-1260-room", "scoped to the room");
  assert.strictEqual(payload.video?.canPublish, true, "canPublish granted");
});

test("mintLiveKitToken: throws when credentials are absent (no scripted fallback)", async () => {
  const originalUrl = process.env.LIVEKIT_URL;
  const originalKey = process.env.LIVEKIT_API_KEY;
  const originalSecret = process.env.LIVEKIT_API_SECRET;

  try {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;

    await assert.rejects(
      () => mintLiveKitToken({ room: "r", identity: "i" }),
      /LiveKit credentials missing/,
    );
  } finally {
    if (originalUrl) process.env.LIVEKIT_URL = originalUrl;
    if (originalKey) process.env.LIVEKIT_API_KEY = originalKey;
    if (originalSecret) process.env.LIVEKIT_API_SECRET = originalSecret;
  }
});

test("hasLiveKitConfig / getLiveKitConfig reflect the server environment", () => {
  const originalUrl = process.env.LIVEKIT_URL;
  const originalKey = process.env.LIVEKIT_API_KEY;
  const originalSecret = process.env.LIVEKIT_API_SECRET;

  try {
    process.env.LIVEKIT_URL = TEST_CONFIG.url;
    process.env.LIVEKIT_API_KEY = TEST_CONFIG.apiKey;
    process.env.LIVEKIT_API_SECRET = TEST_CONFIG.apiSecret;
    assert.strictEqual(hasLiveKitConfig(), true, "true when all creds present");
    assert.deepStrictEqual(getLiveKitConfig(), TEST_CONFIG, "reads creds from env");

    delete process.env.LIVEKIT_URL;
    assert.strictEqual(hasLiveKitConfig(), false, "false when URL missing");
    assert.throws(() => getLiveKitConfig(), /LiveKit credentials missing/);
  } finally {
    if (originalUrl) process.env.LIVEKIT_URL = originalUrl;
    else delete process.env.LIVEKIT_URL;
    if (originalKey) process.env.LIVEKIT_API_KEY = originalKey;
    else delete process.env.LIVEKIT_API_KEY;
    if (originalSecret) process.env.LIVEKIT_API_SECRET = originalSecret;
    else delete process.env.LIVEKIT_API_SECRET;
  }
});
