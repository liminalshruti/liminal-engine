/**
 * VoiceCorrection — GENUINELY LIVE browser mic publish via LiveKit (client-only).
 *
 * REAL BEHAVIOR (no scripted transcript, no server SDK in the browser):
 * 1. Operator clicks "Capture voice correction".
 * 2. The browser fetches a join token from the SERVER token endpoint
 *    (POST /livekit/token on apps/api) — the LiveKit API secret stays on the server.
 * 3. With livekit-client only: `new Room()`, `room.connect(url, token)`,
 *    `createLocalTracks({ audio: true })` (real getUserMedia mic permission),
 *    then `localParticipant.publishTrack(...)` — the operator's REAL microphone
 *    audio is published to the live room.
 * 4. The published-track state is reported truthfully.
 *
 * There is no STT wired in this build, so we DO NOT fabricate a transcript. When
 * the server has no LiveKit credentials (HTTP 503), the control shows a truthful
 * "live voice unavailable" state — never a fake transcript.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, createLocalTracks, type LocalTrack } from "livekit-client";

import "./VoiceCorrection.css";

/** Base URL of the apps/api server (defaults to same-origin via the dev proxy). */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_ENDPOINT = `${API_BASE}/livekit/token`;

type CaptureStatus = "idle" | "connecting" | "publishing" | "stopping";

interface TokenResponse {
  token?: string;
  url?: string;
  room?: string;
}

export interface VoiceCorrectionProps {
  /** Room to publish into. Defaults to "correction-room". */
  room?: string;
}

export function VoiceCorrection({ room = "correction-room" }: VoiceCorrectionProps) {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [liveRoom, setLiveRoom] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const tracksRef = useRef<LocalTrack[]>([]);

  const teardown = useCallback(async () => {
    for (const track of tracksRef.current) {
      try {
        track.stop();
      } catch {
        /* releasing the mic is best-effort */
      }
    }
    tracksRef.current = [];
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch {
        /* disconnect is best-effort */
      }
      roomRef.current = null;
    }
  }, []);

  // Release the mic + room if the screen unmounts while publishing.
  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  const handleStart = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    setUnavailable(null);

    try {
      const identity = `operator-${Date.now()}`;
      const res = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, identity }),
      });

      // Server has no LiveKit credentials → truthful disabled state (no fake transcript).
      if (res.status === 503) {
        setUnavailable(
          "Live voice unavailable — the server has no LiveKit credentials configured.",
        );
        setStatus("idle");
        return;
      }
      if (!res.ok) {
        throw new Error(`Token endpoint returned HTTP ${res.status}`);
      }

      const data = (await res.json()) as TokenResponse;
      const token = data.token;
      const url = data.url ?? import.meta.env.VITE_LIVEKIT_URL;
      if (!token || !url) {
        throw new Error("Token endpoint did not return a token and url");
      }

      // GENUINELY LIVE: connect + publish the REAL microphone track.
      const liveKitRoom = new Room();
      roomRef.current = liveKitRoom;
      await liveKitRoom.connect(url, token);

      const tracks = await createLocalTracks({ audio: true, video: false });
      tracksRef.current = tracks;
      for (const track of tracks) {
        await liveKitRoom.localParticipant.publishTrack(track);
      }

      setLiveRoom(data.room ?? room);
      setStatus("publishing");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[VoiceCorrection] live capture failed:", message, err);
      setError(`Live capture failed: ${message}`);
      await teardown();
      setStatus("idle");
    }
  }, [room, teardown]);

  const handleStop = useCallback(async () => {
    setStatus("stopping");
    await teardown();
    setLiveRoom(null);
    setStatus("idle");
  }, [teardown]);

  const isBusy = status === "connecting" || status === "stopping";
  const isPublishing = status === "publishing";

  return (
    <div className="voice-correction">
      <div className="voice-correction__header">
        <p className="voice-correction__eyebrow">Voice Correction (Optional)</p>
        <p className="voice-correction__description">
          Publish a live voice correction. Your real microphone audio is streamed to a
          LiveKit room via a server-minted token.
        </p>
      </div>

      {!isPublishing ? (
        <div className="voice-correction__capture">
          <button
            type="button"
            className="voice-correction__button"
            disabled={isBusy}
            onClick={handleStart}
            aria-busy={isBusy}
          >
            <span className={`voice-correction__icon${isBusy ? " is-listening" : ""}`}>
              🎤
            </span>
            <span className="voice-correction__text">
              {status === "connecting"
                ? "Connecting to LiveKit…"
                : "Capture Voice Correction"}
            </span>
          </button>
        </div>
      ) : (
        <div className="voice-correction__result">
          <div className="voice-correction__transcript">
            <p className="voice-correction__status">
              ● Live — publishing your microphone to room "{liveRoom}"
            </p>
            <p className="voice-correction__placeholder">
              Real audio is being published to the live room. Speech-to-text
              transcription is not yet wired in this build, so no transcript is shown.
            </p>
          </div>

          <button
            type="button"
            className="voice-correction__reset"
            onClick={handleStop}
          >
            Stop publishing
          </button>
        </div>
      )}

      {unavailable && (
        <div className="voice-correction__unavailable" role="status">
          {unavailable}
        </div>
      )}

      {error && (
        <div className="voice-correction__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export default VoiceCorrection;
