/**
 * CorrectionTemplateForm — a structured form component for the operator to
 * correct a GovernanceCase by selecting one or more correction templates,
 * filling in their structured arguments, and previewing the compiled
 * EnforcementActions before activation.
 *
 * Implements the key anti-vagueness measure (specs/IDEAS.md): reviewer picks
 * one+ templates + fills structured args; enforcement compiles ONLY from the
 * schema (not from free text). Rejects vague/empty corrections with actionable
 * error feedback.
 *
 * Templates map to the canonical EnforcementAction.actionType enum:
 *   - "always include X" → require_fields
 *   - "never do X" → forbid_patterns / deny_tool
 *   - "ask before Y" → require_approval
 *   - "match this shape" → output_schema
 *   - "status flip" → change_status
 *   - "create workstream" → create_linear_workstream
 *   - "assign responsibility" → assign_owner
 *   - "block future action" → block_agent_action
 *   - "generate an eval" → generate_eval
 *   - "activate a policy" → activate_policy
 *   - "record evidence" → record_audit_event
 *
 * Feature flag: `--feature-correction-template-ui` (default: false during
 * hackathon; set in SUBMISSION.md for judges).
 */

import { useState } from "react";
import type { GovernanceCase, EnforcementAction } from "@liminal-engine/contracts";
import { Card } from "./index";

/** A single template the operator can apply. */
export interface CorrectionTemplate {
  id: string;
  label: string;
  description: string;
  actionType: EnforcementAction["actionType"];
  fields: TemplateField[];
}

export interface TemplateField {
  id: string;
  label: string;
  type: "text" | "select" | "checkbox" | "textarea";
  placeholder?: string;
  options?: string[];
  required?: boolean;
  hint?: string;
}

/** The operator's selections for a single template. */
export interface TemplateSelection {
  templateId: string;
  values: Record<string, string | boolean>;
}

export interface CorrectionTemplateFormProps {
  /** The case being corrected. */
  governanceCase: GovernanceCase;
  /** The available templates to choose from. */
  templates: CorrectionTemplate[];
  /** Callback when correction is submitted with selected templates. */
  onSubmit?: (selections: TemplateSelection[], freeTextReason: string) => void;
  /** Optional CSS class for custom styling. */
  className?: string;
}

/**
 * Compile selected templates + filled arguments into preview EnforcementActions.
 * This is a pure preview function — the real compilation happens in
 * compile-correction.ts (packages/governance/src/).
 */
function compileTemplatePreview(
  selections: TemplateSelection[],
  caseId: string,
): Partial<EnforcementAction>[] {
  // STUB: In a real implementation, this calls the gov-correct compiler.
  // For now, return a simplified preview structure for demo purposes.
  return selections.map((sel) => {
    const template = CORRECTION_TEMPLATES.find((t) => t.id === sel.templateId);
    if (!template) return {};

    return {
      id: `ea_preview_${sel.templateId}`,
      caseId,
      actionType: template.actionType,
      payload: sel.values,
    };
  });
}

/**
 * Built-in correction templates (the catalog operators choose from).
 * Maps to specs/IDEAS.md phrase→action table.
 */
export const CORRECTION_TEMPLATES: CorrectionTemplate[] = [
  {
    id: "require-fields",
    label: "Always include field",
    description: "Require a specific field to be present in all outputs",
    actionType: "require_approval",
    fields: [
      {
        id: "field-name",
        label: "Field name",
        type: "text",
        placeholder: "e.g., EU data residency",
        required: true,
        hint: "The required field that must not be dropped",
      },
      {
        id: "field-description",
        label: "Why it matters",
        type: "textarea",
        placeholder: "Business or compliance reason",
        hint: "Evidence or rationale for this requirement",
      },
    ],
  },
  {
    id: "forbid-pattern",
    label: "Never claim without evidence",
    description: "Block claims that lack supporting evidence or citations",
    actionType: "block_agent_action",
    fields: [
      {
        id: "pattern",
        label: "Claim pattern to block",
        type: "text",
        placeholder: "e.g., 'is on track'",
        required: true,
      },
      {
        id: "required-evidence",
        label: "Required evidence",
        type: "textarea",
        placeholder: "What evidence is required to support this claim?",
        required: true,
      },
    ],
  },
  {
    id: "require-approval",
    label: "Ask before action",
    description: "Require explicit approval before a specific action is allowed",
    actionType: "require_approval",
    fields: [
      {
        id: "action",
        label: "Action requiring approval",
        type: "text",
        placeholder: "e.g., send customer update",
        required: true,
      },
      {
        id: "approvers",
        label: "Approver roles (comma-separated)",
        type: "text",
        placeholder: "e.g., VP Ops, Security Lead",
        required: true,
      },
    ],
  },
  {
    id: "output-schema",
    label: "Match this shape",
    description: "Require outputs to match a specific schema or structure",
    actionType: "activate_policy",
    fields: [
      {
        id: "schema-name",
        label: "Schema name",
        type: "text",
        placeholder: "e.g., ACL_COMPLIANCE",
        required: true,
      },
      {
        id: "schema-url",
        label: "Schema reference (optional)",
        type: "text",
        placeholder: "Link to schema definition",
      },
    ],
  },
  {
    id: "generate-eval",
    label: "Generate evaluation",
    description: "Automatically generate an evaluation case to verify the correction",
    actionType: "generate_eval",
    fields: [
      {
        id: "eval-criteria",
        label: "What should be evaluated?",
        type: "textarea",
        placeholder: "e.g., Verify EU residency requirement is honored in next run",
        required: true,
      },
    ],
  },
  {
    id: "assign-owner",
    label: "Assign responsibility",
    description: "Assign ownership for resolving this correction",
    actionType: "assign_owner",
    fields: [
      {
        id: "owner-role",
        label: "Owner role",
        type: "select",
        options: [
          "VP Ops / Head of AI Transformation",
          "Product Lead",
          "Security Lead",
          "Engineering Lead",
        ],
        required: true,
      },
      {
        id: "deadline",
        label: "Deadline (optional)",
        type: "text",
        placeholder: "e.g., 24 hours from now",
      },
    ],
  },
];

/**
 * CorrectionTemplateForm component — lets the operator select templates,
 * fill arguments, and preview compiled enforcement actions.
 */
export function CorrectionTemplateForm({
  governanceCase,
  templates = CORRECTION_TEMPLATES,
  onSubmit,
  className,
}: CorrectionTemplateFormProps) {
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(
    new Set(),
  );
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, string | boolean>>>({});
  const [freeTextReason, setFreeTextReason] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleTemplateToggle = (templateId: string) => {
    const newSelected = new Set(selectedTemplateIds);
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId);
      const newValues = { ...fieldValues };
      delete newValues[templateId];
      setFieldValues(newValues);
    } else {
      newSelected.add(templateId);
      setFieldValues({
        ...fieldValues,
        [templateId]: {},
      });
    }
    setSelectedTemplateIds(newSelected);
    setErrors([]);
  };

  const handleFieldChange = (templateId: string, fieldId: string, value: string | boolean) => {
    setFieldValues({
      ...fieldValues,
      [templateId]: {
        ...fieldValues[templateId],
        [fieldId]: value,
      },
    });
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (selectedTemplateIds.size === 0) {
      newErrors.push("Select at least one correction template.");
    }

    if (!freeTextReason.trim()) {
      newErrors.push("Provide a human-readable reason for the correction.");
    }

    for (const templateId of selectedTemplateIds) {
      const template = templates.find((t) => t.id === templateId);
      if (!template) continue;

      for (const field of template.fields) {
        if (field.required) {
          const value = fieldValues[templateId]?.[field.id];
          if (!value || (typeof value === "string" && !value.trim())) {
            newErrors.push(`${template.label}: "${field.label}" is required.`);
          }
        }
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const selections: TemplateSelection[] = Array.from(selectedTemplateIds).map(
      (templateId) => ({
        templateId,
        values: fieldValues[templateId] || {},
      }),
    );

    if (onSubmit) {
      onSubmit(selections, freeTextReason);
    }
  };

  const previewActions = showPreview
    ? compileTemplatePreview(
        Array.from(selectedTemplateIds).map((tId) => ({
          templateId: tId,
          values: fieldValues[tId] || {},
        })),
        governanceCase.id,
      )
    : [];

  return (
    <Card
      className={`correction-template-form${className ? ` ${className}` : ""}`}
      title="Structured Correction"
    >
      <form onSubmit={handleSubmit} className="correction-form__wrapper">
        {/* Error display */}
        {errors.length > 0 && (
          <div className="correction-form__errors" role="alert">
            <h4 className="correction-form__error-title">Correction incomplete:</h4>
            <ul className="correction-form__error-list">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Template selection */}
        <fieldset className="correction-form__fieldset">
          <legend className="correction-form__legend">
            1. Select one or more correction templates
          </legend>
          <p className="correction-form__help">
            Pick the enforcement type(s) you want to apply to this case.
          </p>
          <div className="correction-form__templates">
            {templates.map((template) => (
              <label
                key={template.id}
                className={`correction-form__template-choice ${
                  selectedTemplateIds.has(template.id)
                    ? "is-selected"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTemplateIds.has(template.id)}
                  onChange={() => handleTemplateToggle(template.id)}
                  className="correction-form__checkbox"
                />
                <div className="correction-form__template-label">
                  <strong>{template.label}</strong>
                  <p className="correction-form__template-desc">
                    {template.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Template field inputs */}
        {selectedTemplateIds.size > 0 && (
          <fieldset className="correction-form__fieldset">
            <legend className="correction-form__legend">
              2. Fill in the template arguments
            </legend>
            {templates.map(
              (template) =>
                selectedTemplateIds.has(template.id) && (
                  <div
                    key={template.id}
                    className="correction-form__template-fields"
                  >
                    <h4 className="correction-form__template-heading">
                      {template.label}
                    </h4>
                    {template.fields.map((field) => (
                      <div
                        key={field.id}
                        className={`correction-form__field ${
                          field.required ? "is-required" : ""
                        }`}
                      >
                        <label
                          htmlFor={`${template.id}_${field.id}`}
                          className="correction-form__field-label"
                        >
                          {field.label}
                          {field.required && (
                            <span
                              className="correction-form__required-indicator"
                              aria-label="required"
                            >
                              {" "}
                              *
                            </span>
                          )}
                        </label>

                        {field.type === "text" && (
                          <input
                            id={`${template.id}_${field.id}`}
                            type="text"
                            placeholder={field.placeholder}
                            value={
                              (fieldValues[template.id]?.[field.id] as string) ||
                              ""
                            }
                            onChange={(e) =>
                              handleFieldChange(
                                template.id,
                                field.id,
                                e.target.value,
                              )
                            }
                            className="correction-form__input"
                          />
                        )}

                        {field.type === "textarea" && (
                          <textarea
                            id={`${template.id}_${field.id}`}
                            placeholder={field.placeholder}
                            value={
                              (fieldValues[template.id]?.[field.id] as string) ||
                              ""
                            }
                            onChange={(e) =>
                              handleFieldChange(
                                template.id,
                                field.id,
                                e.target.value,
                              )
                            }
                            className="correction-form__textarea"
                            rows={3}
                          />
                        )}

                        {field.type === "select" && (
                          <select
                            id={`${template.id}_${field.id}`}
                            value={
                              (fieldValues[template.id]?.[field.id] as string) ||
                              ""
                            }
                            onChange={(e) =>
                              handleFieldChange(
                                template.id,
                                field.id,
                                e.target.value,
                              )
                            }
                            className="correction-form__select"
                          >
                            <option value="">
                              {field.placeholder || "Select..."}
                            </option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {field.type === "checkbox" && (
                          <input
                            id={`${template.id}_${field.id}`}
                            type="checkbox"
                            checked={
                              (fieldValues[template.id]?.[field.id] as boolean) ||
                              false
                            }
                            onChange={(e) =>
                              handleFieldChange(
                                template.id,
                                field.id,
                                e.target.checked,
                              )
                            }
                            className="correction-form__checkbox"
                          />
                        )}

                        {field.hint && (
                          <p className="correction-form__field-hint">
                            {field.hint}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ),
            )}
          </fieldset>
        )}

        {/* Free text reason */}
        <fieldset className="correction-form__fieldset">
          <legend className="correction-form__legend">
            3. Explain the correction (human-readable)
          </legend>
          <p className="correction-form__help">
            This text is recorded in the AuditEvent for provenance, but the
            enforcement compiles ONLY from the structured templates above.
          </p>
          <textarea
            value={freeTextReason}
            onChange={(e) => {
              setFreeTextReason(e.target.value);
              setErrors([]);
            }}
            placeholder="e.g., The EU data residency requirement was silently dropped in the first pass, putting the $1.2M deal at risk. This correction makes it a hard requirement for the next pass."
            className="correction-form__textarea correction-form__reason"
            rows={4}
          />
        </fieldset>

        {/* Preview button */}
        {selectedTemplateIds.size > 0 && (
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="correction-form__preview-btn"
          >
            {showPreview ? "Hide Preview" : "Preview Compiled Rules"}
          </button>
        )}

        {/* Preview panel */}
        {showPreview && previewActions.length > 0 && (
          <div className="correction-form__preview">
            <h4 className="correction-form__preview-title">
              Compiled Enforcement Actions
            </h4>
            <p className="correction-form__preview-note">
              These rules will be activated if you approve the correction:
            </p>
            <div className="correction-form__preview-actions">
              {previewActions.map((action, i) => (
                <div key={i} className="correction-form__preview-action">
                  <dl className="correction-form__preview-fields">
                    <dt>Action type</dt>
                    <dd>
                      <code>{action.actionType}</code>
                    </dd>
                    {action.payload && Object.keys(action.payload).length > 0 && (
                      <>
                        <dt>Parameters</dt>
                        <dd>
                          <pre className="correction-form__preview-code">
                            {JSON.stringify(action.payload, null, 2)}
                          </pre>
                        </dd>
                      </>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="correction-form__actions">
          <button
            type="submit"
            className="correction-form__submit-btn"
            disabled={selectedTemplateIds.size === 0}
          >
            Save Correction & Compile
          </button>
        </div>
      </form>
    </Card>
  );
}

export default CorrectionTemplateForm;
