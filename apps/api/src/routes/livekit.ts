/**
 * POST /livekit/token — SERVER-SIDE LiveKit join-token minting.
 *
 * The browser (apps/desktop-demo VoiceCorrection, using livekit-client only)
 * POSTs `{ room, identity }` and receives `{ token, url }`. The token is minted
 * here via @liminal-engine/integration-livekit#mintLiveKitToken using
 * livekit-server-sdk with LIVEKIT_API_KEY / LIVEKIT_API_SECRET from SERVER env —
 * the secret is used only on the server and NEVER reaches the browser bundle.
 *
 * If LiveKit is not configured on the server → HTTP 503 (NO scripted fallback).
 * The browser then renders a truthful "live voice unavailable" state.
 *
 * Determinism / testability: hasConfig + mintToken are injectable so the endpoint
 * is exercised fully offline (no SDK call, no network) in apps/api/test.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  hasLiveKitConfig,
  mintLiveKitToken,
  type LiveKitToken,
  type MintTokenDeps,
  type MintTokenParams,
} from "@liminal-engine/integration-livekit";

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

/** A non-empty trimmed string, or the provided fallback. */
function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export interface LiveKitRouterDeps {
  /** Defaults to checking server env (LIVEKIT_URL/KEY/SECRET). */
  hasConfig?: () => boolean;
  /** Defaults to the real, SDK-backed mintLiveKitToken. */
  mintToken?: (params: MintTokenParams, deps?: MintTokenDeps) => Promise<LiveKitToken>;
}

export interface LiveKitRouter {
  token(req: IncomingMessage, res: ServerResponse): Promise<void>;
}

export function createLiveKitRouter(deps: LiveKitRouterDeps = {}): LiveKitRouter {
  const hasConfig = deps.hasConfig ?? hasLiveKitConfig;
  const mintToken = deps.mintToken ?? mintLiveKitToken;

  return {
    /**
     * POST /livekit/token
     * Body: { room?: string, identity?: string }
     * 200 { token, url, room, identity } | 503 (creds not configured) | 500
     */
    async token(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        if (!hasConfig()) {
          sendJson(res, 503, {
            error:
              "LiveKit is not configured on the server (set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).",
          });
          return;
        }

        const body = await readJsonBody(req);
        const room = stringOr(body.room, "correction-room");
        const identity = stringOr(body.identity, `operator-${Date.now()}`);

        const { token, url } = await mintToken({ room, identity });

        sendJson(res, 200, { token, url, room, identity });
      } catch (err) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
  };
}

/** Default router used by the server: real env check + real SDK-backed mint. */
export const livekitRouter: LiveKitRouter = createLiveKitRouter();
