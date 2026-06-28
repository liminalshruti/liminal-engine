/**
 * ViolationHighlight component tests — verify inline violation highlighting works correctly.
 *
 * Tests the component's ability to find and highlight violation text within a full text.
 * Per AGENTS.md Rule 6: real logic + real tests, no stubbed-as-real.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ViolationHighlight } from "./ViolationHighlight";

describe("ViolationHighlight component", () => {
  it("renders the full text when no violation is found", () => {
    const fullText = "Acme expansion appears on track";
    const violation = "data retention";

    const { container } = render(
      <ViolationHighlight violation={violation} fullText={fullText} />
    );

    expect(container.textContent).toBe(fullText);
    expect(container.querySelector("mark")).not.toBeInTheDocument();
  });

  it("highlights the violation text when found in fullText", () => {
    const fullText = "Acme expansion appears on track";
    const violation = "appears on track";

    const { container } = render(
      <ViolationHighlight violation={violation} fullText={fullText} />
    );

    const mark = container.querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark?.textContent).toBe("appears on track");
  });

  it("applies the correct severity class to the mark element", () => {
    const fullText = "EU data residency was dropped";
    const violation = "EU data residency";

    const { container } = render(
      <ViolationHighlight
        violation={violation}
        fullText={fullText}
        severity="blocking"
      />
    );

    const mark = container.querySelector("mark");
    expect(mark).toHaveClass("violation-highlight__mark--blocking");
  });

  it("handles case-insensitive violation matching", () => {
    const fullText = "Acme expansion appears on track";
    const violation = "APPEARS ON TRACK";

    const { container } = render(
      <ViolationHighlight violation={violation} fullText={fullText} />
    );

    const mark = container.querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark?.textContent).toBe("appears on track");
  });

  it("applies different severity classes correctly", () => {
    const fullText = "EU data residency requirement missing";
    const violation = "EU data residency";

    const severities = ["blocking", "high", "medium", "low"] as const;

    severities.forEach((severity) => {
      const { container } = render(
        <ViolationHighlight
          violation={violation}
          fullText={fullText}
          severity={severity}
        />
      );

      const mark = container.querySelector("mark");
      expect(mark).toHaveClass(`violation-highlight__mark--${severity}`);
    });
  });

  it("renders text before and after the violation", () => {
    const fullText = "The EU data residency requirement is critical";
    const violation = "EU data residency";

    const { container } = render(
      <ViolationHighlight violation={violation} fullText={fullText} />
    );

    const span = container.querySelector(".violation-highlight__text");
    const textBefore = Array.from(span?.childNodes ?? [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join("");

    expect(span?.textContent).toBe(fullText);
    // Check that the structure includes text, mark, and more text
    expect(span?.querySelector("mark")).toBeInTheDocument();
  });

  it("defaults to blocking severity when not specified", () => {
    const fullText = "EU data residency was dropped";
    const violation = "EU data residency";

    const { container } = render(
      <ViolationHighlight violation={violation} fullText={fullText} />
    );

    const mark = container.querySelector("mark");
    expect(mark).toHaveClass("violation-highlight__mark--blocking");
  });

  it("wraps violation text in the correct CSS classes", () => {
    const fullText = "Dropped requirement: EU data residency";
    const violation = "EU data residency";

    const { container } = render(
      <ViolationHighlight violation={violation} fullText={fullText} />
    );

    const mark = container.querySelector("mark");
    expect(mark).toHaveClass("violation-highlight__mark");
    expect(mark).toHaveClass("violation-highlight__mark--blocking");
  });
});
