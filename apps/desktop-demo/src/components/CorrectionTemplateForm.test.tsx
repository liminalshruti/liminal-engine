/**
 * Unit tests for CorrectionTemplateForm component
 *
 * Tests the core UX logic: template selection, field validation, error handling,
 * and the preview compilation of templates into enforcement actions.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CorrectionTemplateForm, CORRECTION_TEMPLATES } from "./CorrectionTemplateForm";
import type { GovernanceCase } from "@liminal-engine/contracts";

// Mock fixture case for testing
const mockGovernanceCase: GovernanceCase = {
  id: "gc_test_eu",
  category: "missing_required_anchor",
  status: "open",
  detectedAt: "2026-06-27T10:02:00.000Z",
  businessImpact: "Test impact",
  missingFrom: ["first_pass_output"],
};

describe("CorrectionTemplateForm", () => {
  describe("rendering", () => {
    it("renders the form with template selection section", () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      expect(
        screen.getByText("1. Select one or more correction templates"),
      ).toBeInTheDocument();
      expect(screen.getByText("Always include field")).toBeInTheDocument();
    });

    it("renders all available templates as checkbox options", () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      CORRECTION_TEMPLATES.forEach((template) => {
        expect(screen.getByText(template.label)).toBeInTheDocument();
        expect(screen.getByText(template.description)).toBeInTheDocument();
      });
    });

    it("renders the free-text reason section", () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      expect(
        screen.getByText("3. Explain the correction (human-readable)"),
      ).toBeInTheDocument();
    });

    it("renders submit button as disabled when no templates selected", () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const submitBtn = screen.getByRole("button", {
        name: /Save Correction & Compile/i,
      });
      expect(submitBtn).toBeDisabled();
    });
  });

  describe("template selection", () => {
    it("enables the submit button when a template is selected", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      await waitFor(() => {
        const submitBtn = screen.getByRole("button", {
          name: /Save Correction & Compile/i,
        });
        expect(submitBtn).not.toBeDisabled();
      });
    });

    it("shows template-specific fields when a template is selected", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(screen.getByText("2. Fill in the template arguments")).toBeInTheDocument();
        expect(screen.getByLabelText(/Field name/)).toBeInTheDocument();
      });
    });

    it("allows multiple templates to be selected", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox1 = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      const checkbox2 = screen.getByRole("checkbox", {
        name: /Never claim without evidence/i,
      });

      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);

      await waitFor(() => {
        expect(checkbox1).toBeChecked();
        expect(checkbox2).toBeChecked();
      });
    });

    it("removes template fields when unchecking a template", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });

      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(screen.getByLabelText(/Field name/)).toBeInTheDocument();
      });

      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(screen.queryByLabelText(/Field name/)).not.toBeInTheDocument();
      });
    });
  });

  describe("field validation", () => {
    it("shows error when submitting with no templates selected", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const reasonField = screen.getByPlaceholderText(
        /The EU data residency/,
      );
      fireEvent.change(reasonField, {
        target: { value: "Test reason" },
      });

      const submitBtn = screen.getByRole("button", {
        name: /Save Correction & Compile/i,
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Select at least one/i)).toBeInTheDocument();
      });
    });

    it("shows error when submitting with empty reason", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      await waitFor(() => {
        const submitBtn = screen.getByRole("button", {
          name: /Save Correction & Compile/i,
        });
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Provide a human-readable reason/i),
        ).toBeInTheDocument();
      });
    });

    it("shows error when required template field is empty", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      const reasonField = await screen.findByPlaceholderText(
        /The EU data residency/,
      );
      fireEvent.change(reasonField, {
        target: { value: "Test reason" },
      });

      const submitBtn = screen.getByRole("button", {
        name: /Save Correction & Compile/i,
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Always include field.*Field name.*is required/i),
        ).toBeInTheDocument();
      });
    });

    it("clears errors when user fills in required fields", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      const submitBtn = await screen.findByRole("button", {
        name: /Save Correction & Compile/i,
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/is required/)).toBeInTheDocument();
      });

      const fieldNameInput = screen.getByLabelText(/Field name/);
      fireEvent.change(fieldNameInput, {
        target: { value: "EU data residency" },
      });

      await waitFor(() => {
        expect(screen.queryByText(/is required/)).not.toBeInTheDocument();
      });
    });
  });

  describe("form submission", () => {
    it("calls onSubmit with template selections and reason when form is valid", async () => {
      const onSubmit = vi.fn();

      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
          onSubmit={onSubmit}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      const fieldNameInput = await screen.findByLabelText(/Field name/);
      fireEvent.change(fieldNameInput, {
        target: { value: "EU data residency" },
      });

      const reasonField = screen.getByPlaceholderText(/The EU data residency/);
      fireEvent.change(reasonField, {
        target: { value: "Critical compliance requirement" },
      });

      const submitBtn = screen.getByRole("button", {
        name: /Save Correction & Compile/i,
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              templateId: "require-fields",
              values: expect.objectContaining({
                "field-name": "EU data residency",
              }),
            }),
          ]),
          "Critical compliance requirement",
        );
      });
    });

    it("does not call onSubmit if validation fails", async () => {
      const onSubmit = vi.fn();

      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
          onSubmit={onSubmit}
        />,
      );

      const reasonField = screen.getByPlaceholderText(/The EU data residency/);
      fireEvent.change(reasonField, {
        target: { value: "Test reason" },
      });

      const submitBtn = screen.getByRole("button", {
        name: /Save Correction & Compile/i,
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).not.toHaveBeenCalled();
      });
    });
  });

  describe("preview functionality", () => {
    it("shows preview button when templates are selected", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: /Preview Compiled Rules/i,
          }),
        ).toBeInTheDocument();
      });
    });

    it("toggles preview panel when preview button is clicked", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      const previewBtn = await screen.findByRole("button", {
        name: /Preview Compiled Rules/i,
      });
      fireEvent.click(previewBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Compiled Enforcement Actions/),
        ).toBeInTheDocument();
      });

      fireEvent.click(previewBtn);

      await waitFor(() => {
        expect(
          screen.queryByText(/Compiled Enforcement Actions/),
        ).not.toBeInTheDocument();
      });
    });

    it("shows action type in preview", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      const fieldNameInput = await screen.findByLabelText(/Field name/);
      fireEvent.change(fieldNameInput, {
        target: { value: "Test field" },
      });

      const previewBtn = screen.getByRole("button", {
        name: /Preview Compiled Rules/i,
      });
      fireEvent.click(previewBtn);

      await waitFor(() => {
        expect(screen.getByText(/require_approval/)).toBeInTheDocument();
      });
    });
  });

  describe("accessibility", () => {
    it("has proper aria-labels for buttons", () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      checkboxes.forEach((checkbox) => {
        expect(checkbox).toHaveAccessibleName();
      });
    });

    it("marks required fields with asterisk and required attribute", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      const fieldNameInput = await screen.findByLabelText(/Field name \*/);
      expect(fieldNameInput).toBeInTheDocument();
    });

    it("displays error message as an alert", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const reasonField = screen.getByPlaceholderText(/The EU data residency/);
      fireEvent.change(reasonField, {
        target: { value: "Test reason" },
      });

      const submitBtn = screen.getByRole("button", {
        name: /Save Correction & Compile/i,
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        const errorDiv = screen.getByRole("alert");
        expect(errorDiv).toBeInTheDocument();
      });
    });
  });

  describe("form field types", () => {
    it("renders text inputs for text field types", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      const textInput = await screen.findByLabelText(/Field name/);
      expect(textInput).toHaveAttribute("type", "text");
    });

    it("renders textareas for textarea field types", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Always include field/i,
      });
      fireEvent.click(checkbox);

      const textareaFields = await screen.findAllByRole("textbox");
      expect(textareaFields.length).toBeGreaterThan(1);
    });

    it("renders select dropdowns for select field types", async () => {
      render(
        <CorrectionTemplateForm
          governanceCase={mockGovernanceCase}
          templates={CORRECTION_TEMPLATES}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /Assign responsibility/i,
      });
      fireEvent.click(checkbox);

      await waitFor(() => {
        const selectField = screen.getByLabelText(/Owner role/);
        expect(selectField.tagName).toBe("SELECT");
      });
    });
  });
});
