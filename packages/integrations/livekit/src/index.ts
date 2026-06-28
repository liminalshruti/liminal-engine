/**
 * LiveKit adapter — FIXTURE STUB. Scripted/static transcript, no live voice
 * (DEMO_CONTRACT cut-if-risky: "Real LiveKit voice → scripted / static transcript").
 * Voice is optional chrome; never on the must-not-cut spine.
 */
export interface TranscriptLine {
  speaker: string; // a ROLE, never an invented persona name
  text: string;
}

export function scriptedTranscript(): TranscriptLine[] {
  return [
    { speaker: "the operator", text: "Acme shows on-track — but did we keep EU data residency?" },
    { speaker: "Liminal Engine", text: "No. It was silently dropped. Opening a governance case." },
    { speaker: "the operator", text: "Approve and enforce the correction." },
  ];
}
