/**
 * ViolationHighlight — inline marker for dropped/violated requirements in agent output.
 *
 * Renders a violation indicator (badge + inline highlight) for a violation text
 * found in the false-green output. Used by GovernanceCase screen to mark the
 * dropped EU data-residency requirement visibly in the agent's claim.
 *
 * Per IDEAS.md Demo/UX #1: "first-pass output with inline-highlighted violations".
 */

export interface ViolationHighlightProps {
  /** The violation text to highlight (e.g., "EU data residency"). */
  violation: string;
  /** The full text containing the violation (e.g., the agent's claim). */
  fullText: string;
  /** Severity level for styling (blocking, high, medium, low). */
  severity?: "blocking" | "high" | "medium" | "low";
}

/**
 * Renders text with violations highlighted inline.
 *
 * If the violation text appears in fullText, it's wrapped in a <mark> element
 * with a violation-specific class for styling. If it doesn't appear, just
 * displays the full text.
 */
export function ViolationHighlight({
  violation,
  fullText,
  severity = "blocking",
}: ViolationHighlightProps) {
  // Check if the violation text appears in the full text (case-insensitive)
  const violationLower = violation.toLowerCase();
  const fullTextLower = fullText.toLowerCase();
  const index = fullTextLower.indexOf(violationLower);

  if (index === -1) {
    // Violation text not found in fullText; just render fullText as-is
    return <span className="violation-highlight__text">{fullText}</span>;
  }

  // Split the text and wrap the violation in a mark element
  const before = fullText.substring(0, index);
  const violationText = fullText.substring(index, index + violation.length);
  const after = fullText.substring(index + violation.length);

  return (
    <span className="violation-highlight__text">
      {before}
      <mark className={`violation-highlight__mark violation-highlight__mark--${severity}`}>
        {violationText}
      </mark>
      {after}
    </span>
  );
}

export default ViolationHighlight;
