/**
 * LiveKit adapter — SERVER-ONLY join-token minting for genuinely-live rooms.
 *
 * This package uses `livekit-server-sdk` (AccessToken) and reads the LiveKit API
 * SECRET from SERVER env. It must NEVER be imported by the browser bundle.
 *
 * The genuinely-live path is:
 *   browser (apps/desktop-demo VoiceCorrection, livekit-client)
 *     → POST /livekit/token on apps/api
 *       → mintLiveKitToken() here (livekit-server-sdk, LIVEKIT_API_SECRET, server env)
 *     ← { token, url }
 *   browser → new Room(); room.connect(url, token); publish REAL microphone track.
 *
 * NO transcript fixtures live here. There is no STT in this build, so we do not
 * fabricate a transcript — the browser publishes the operator's real microphone
 * audio and reports the published-track state truthfully.
 */

/** Resolved LiveKit server configuration (server env). */
export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

/** What the browser needs to join + publish: a signed JWT and the server URL. */
export interface LiveKitToken {
  /** Signed JWT the browser passes to `room.connect(url, token)`. */
  token: string;
  /** LiveKit server ws/wss URL (from LIVEKIT_URL) the browser connects to. */
  url: string;
}

/** Inputs for a join token. */
export interface MintTokenParams {
  /** Room name to join (LiveKit auto-creates the room on first join). */
  room: string;
  /** Participant identity encoded into the token. */
  identity: string;
}

/** The video grant we attach — narrow, explicit, and asserted by tests. */
export interface AccessTokenVideoGrant {
  room: string;
  roomJoin: boolean;
  canPublish: boolean;
  canPublishData: boolean;
  canSubscribe: boolean;
}

/** Structural slice of livekit-server-sdk's AccessToken we depend on. */
export interface AccessTokenLike {
  addGrant(grant: AccessTokenVideoGrant): void;
  toJwt(): Promise<string>;
}

/** Constructor shape so an offline test can inject a fake AccessToken. */
export interface AccessTokenCtor {
  new (
    apiKey: string,
    apiSecret: string,
    options?: { identity?: string },
  ): AccessTokenLike;
}

/** Injection seams so mintLiveKitToken can be exercised fully OFFLINE. */
export interface MintTokenDeps {
  /** Defaults to reading LiveKit creds from server env via getLiveKitConfig(). */
  config?: LiveKitConfig;
  /** Defaults to the real livekit-server-sdk AccessToken. */
  accessTokenCtor?: AccessTokenCtor;
}

/** True when all three LiveKit server env vars are present. */
export function hasLiveKitConfig(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET,
  );
}

/** Read LiveKit config from server env. Throws if any required var is missing. */
export function getLiveKitConfig(): LiveKitConfig {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error(
      "LiveKit credentials missing: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET required",
    );
  }

  return { url, apiKey, apiSecret };
}

/**
 * Mint a LiveKit join token SERVER-SIDE.
 *
 * Uses the API secret (server env) to sign a JWT that grants the browser
 * participant `roomJoin` + `canPublish` (+ data/subscribe) for the given room.
 * The secret is used here and NEVER leaves the server — only the signed JWT does.
 *
 * Throws if credentials are not configured (callers surface this as HTTP 503;
 * there is NO scripted fallback).
 */
export async function mintLiveKitToken(
  params: MintTokenParams,
  deps: MintTokenDeps = {},
): Promise<LiveKitToken> {
  const config = deps.config ?? getLiveKitConfig(); // throws if creds absent

  const Ctor: AccessTokenCtor =
    deps.accessTokenCtor ?? (await import("livekit-server-sdk")).AccessToken;

  const at = new Ctor(config.apiKey, config.apiSecret, {
    identity: params.identity,
  });

  at.addGrant({
    room: params.room,
    roomJoin: true,
    canPublish: true, // the browser publishes its REAL microphone track
    canPublishData: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return { token, url: config.url };
}
