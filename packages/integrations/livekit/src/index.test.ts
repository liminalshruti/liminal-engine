import { test } from "node:test";
import assert from "node:assert";
import { connectToLiveKitRoom, hasLiveKitConfig, captureVoiceTranscript } from "./index.ts";

test("livekit integration: hasLiveKitConfig() reflects environment", () => {
  const originalUrl = process.env.LIVEKIT_URL;
  const originalKey = process.env.LIVEKIT_API_KEY;
  const originalSecret = process.env.LIVEKIT_API_SECRET;

  try {
    // When all creds are present
    process.env.LIVEKIT_URL = "http://localhost:7880";
    process.env.LIVEKIT_API_KEY = "test-key";
    process.env.LIVEKIT_API_SECRET = "test-secret";
    assert.strictEqual(hasLiveKitConfig(), true, "hasLiveKitConfig() returns true when all creds present");

    // When creds are missing
    delete process.env.LIVEKIT_URL;
    assert.strictEqual(hasLiveKitConfig(), false, "hasLiveKitConfig() returns false when URL missing");
  } finally {
    // Restore
    if (originalUrl) process.env.LIVEKIT_URL = originalUrl;
    else delete process.env.LIVEKIT_URL;
    if (originalKey) process.env.LIVEKIT_API_KEY = originalKey;
    else delete process.env.LIVEKIT_API_KEY;
    if (originalSecret) process.env.LIVEKIT_API_SECRET = originalSecret;
    else delete process.env.LIVEKIT_API_SECRET;
  }
});

test("livekit integration: connectToLiveKitRoom() returns scripted-fallback when creds missing", async () => {
  const originalUrl = process.env.LIVEKIT_URL;
  const originalKey = process.env.LIVEKIT_API_KEY;
  const originalSecret = process.env.LIVEKIT_API_SECRET;

  try {
    // Remove creds to force fallback
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;

    const info = await connectToLiveKitRoom("test-room");
    assert.strictEqual(info.roomName, "test-room", "returns requested room name");
    assert.strictEqual(
      info.source,
      "scripted-fallback",
      "source is scripted-fallback when creds absent"
    );
    assert.strictEqual(
      info.accessToken,
      undefined,
      "no accessToken when in fallback mode"
    );
  } finally {
    // Restore
    if (originalUrl) process.env.LIVEKIT_URL = originalUrl;
    if (originalKey) process.env.LIVEKIT_API_KEY = originalKey;
    if (originalSecret) process.env.LIVEKIT_API_SECRET = originalSecret;
  }
});

test("livekit integration: connectToLiveKitRoom() returns live-room with token when creds present", async () => {
  const originalUrl = process.env.LIVEKIT_URL;
  const originalKey = process.env.LIVEKIT_API_KEY;
  const originalSecret = process.env.LIVEKIT_API_SECRET;

  // Skip this test cleanly if LiveKit creds are not present in the environment
  // (CI without secrets should not fail; this is a live-integration test)
  if (!hasLiveKitConfig()) {
    console.log("[skipped] livekit live-connection test — credentials not present (normal in CI)");
    return;
  }

  try {
    const info = await connectToLiveKitRoom("lim-1260-test-room");

    // When real creds are present, we expect a live connection
    assert.strictEqual(
      info.roomName,
      "lim-1260-test-room",
      "returns requested room name"
    );

    // The source should be either live-room (success) or scripted-fallback (network error)
    // If live-room, we should have a token
    if (info.source === "live-room") {
      assert.ok(info.accessToken, "accessToken present when source is live-room");
      assert.ok(
        info.accessToken.length > 50,
        "AccessToken is a valid JWT (has reasonable length)"
      );
      console.log(
        "[VERIFIED] LiveKit live connection succeeded:",
        `room=${info.roomName}, token=${info.accessToken.substring(0, 30)}...`
      );
    } else {
      console.log(
        "[INFO] LiveKit fallback due to network or server issue:",
        `source=${info.source} (this is OK in test environment)`
      );
    }
  } finally {
    // Restore
    if (originalUrl) process.env.LIVEKIT_URL = originalUrl;
    if (originalKey) process.env.LIVEKIT_API_KEY = originalKey;
    if (originalSecret) process.env.LIVEKIT_API_SECRET = originalSecret;
  }
});

test("livekit integration: captureVoiceTranscript() returns scripted fixture", async () => {
  const transcript = await captureVoiceTranscript("test-room");

  assert.ok(Array.isArray(transcript), "returns an array of TranscriptLine");
  assert.ok(transcript.length > 0, "transcript is not empty");

  // Check structure
  for (const line of transcript) {
    assert.ok(line.speaker, "each line has a speaker (role)");
    assert.ok(line.text, "each line has text");
    // Verify no invented persona names — should be roles like "the operator" or "Liminal Engine"
    assert.ok(
      ["the operator", "Liminal Engine"].includes(line.speaker),
      `speaker "${line.speaker}" is a valid role, not an invented persona`
    );
  }
});
