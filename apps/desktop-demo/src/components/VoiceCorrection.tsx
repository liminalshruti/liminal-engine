/**
 * VoiceCorrection — demonstrate voice-based correction input via LiveKit.
 *
 * This component shows:
 * 1. A "Voice Correction" affordance (microphone button)
 * 2. While capturing, displays status (listening → transcript received)
 * 3. Shows the captured transcript
 * 4. Displays the workflow: "Voice captured → CorrectionEvent → EvalCase → Second pass improved"
 *
 * FALLBACK-SAFE: If LiveKit is unavailable (missing creds, network failure),
 * it uses the scripted fixture transcript. The demo spine never breaks.
 *
 * DEMO-ONLY: This is not a production voice UI. In production, this would integrate
 * with the correction form submission, creating actual CorrectionEvent structs
 * from voice input. For now, it demonstrates the flow deterministically.
 */

import { useCallback, useState } from "react";

/**
 * TranscriptLine — the shape of captured voice transcript.
 * (Matched from @liminal-engine/integration-livekit, but not imported
 * to avoid a live-integration dependency in the demo app.)
 */
export interface TranscriptLine {
  speaker: string;
  text: string;
}

/**
 * scriptedTranscript — fixture-backed voice demonstration.
 * For the demo, this always uses the fixture. The real LiveKit voice
 * capture (packages/integrations/livekit) is wired in the composition
 * root (governance-demo.ts) when real integrations are enabled,
 * not in the demo app itself (LIM-1260 boundary rule).
 */
function scriptedTranscript(): TranscriptLine[] {
  return [
    { speaker: "the operator", text: "Acme shows on-track — but did we keep EU data residency?" },
    { speaker: "Liminal Engine", text: "No. It was silently dropped. Opening a governance case." },
    { speaker: "the operator", text: "Approve and enforce the correction." },
  ];
}

import "./VoiceCorrection.css";

export interface VoiceCorrectionProps {
  /** Callback when voice transcript is captured. Receives the full transcript. */
  onTranscriptCaptured?: (transcript: TranscriptLine[]) => void;
}

export function VoiceCorrection({ onTranscriptCaptured }: VoiceCorrectionProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartCapture = useCallback(async () => {
    setIsCapturing(true);
    setError(null);

    try {
      // For the demo spine, use the scripted fixture (deterministic, no live calls).
      // In a next-wave integration, the composition root (governance-demo.ts) would
      // wire real LiveKit capture here via a hook or wrapper (LIM-1260).
      // The real adapter (packages/integrations/livekit) is implemented and ready.
      const captured = scriptedTranscript();

      setTranscript(captured);
      onTranscriptCaptured?.(captured);

      // Simulate a brief capture time for UX
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);

      // Fallback to scripted if anything goes wrong
      const fallback = scriptedTranscript();
      setTranscript(fallback);
      onTranscriptCaptured?.(fallback);
    } finally {
      setIsCapturing(false);
    }
  }, [onTranscriptCaptured]);

  return (
    <div className="voice-correction">
      <div className="voice-correction__header">
        <p className="voice-correction__eyebrow">Voice Correction (Optional)</p>
        <p className="voice-correction__description">
          Speak a correction to be captured and compiled into a CorrectionEvent.
        </p>
      </div>

      {!transcript ? (
        <div className="voice-correction__capture">
          <button
            type="button"
            className="voice-correction__button"
            disabled={isCapturing}
            onClick={handleStartCapture}
            aria-busy={isCapturing}
          >
            <span className={`voice-correction__icon${isCapturing ? " is-listening" : ""}`}>
              🎤
            </span>
            <span className="voice-correction__text">
              {isCapturing ? "Listening…" : "Capture Voice Correction"}
            </span>
          </button>
        </div>
      ) : (
        <div className="voice-correction__result">
          <div className="voice-correction__transcript">
            <p className="voice-correction__status">✓ Voice correction captured</p>
            <div className="voice-correction__lines">
              {transcript.map((line, i) => (
                <div key={i} className="voice-correction__line">
                  <span className="voice-correction__speaker">{line.speaker}:</span>
                  <span className="voice-correction__text-content">{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="voice-correction__workflow">
            <p className="voice-correction__workflow-title">Correction flow:</p>
            <div className="voice-correction__steps">
              <div className="voice-correction__step voice-correction__step--done">
                <span className="voice-correction__step-label">Voice captured</span>
              </div>
              <span className="voice-correction__step-arrow">→</span>
              <div className="voice-correction__step voice-correction__step--next">
                <span className="voice-correction__step-label">CorrectionEvent created</span>
              </div>
              <span className="voice-correction__step-arrow">→</span>
              <div className="voice-correction__step voice-correction__step--next">
                <span className="voice-correction__step-label">EvalCase generated</span>
              </div>
              <span className="voice-correction__step-arrow">→</span>
              <div className="voice-correction__step voice-correction__step--next">
                <span className="voice-correction__step-label">Second pass improves</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="voice-correction__reset"
            onClick={() => setTranscript(null)}
          >
            Capture again
          </button>
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
