/**
 * Shared UI components for the demo spine.
 * Each component is typed against the contracts and deterministic fixtures.
 * No live calls on the spine — all components render from fixture data.
 *
 * Screens import from this barrel:
 *   import { StatusBadge, Card } from "../components";
 */

export { StatusBadge, type StatusBadgeProps } from "./StatusBadge.tsx";
export { EvalTable, type EvalTableProps } from "./EvalTable.tsx";
export { LinearPayloadView, type LinearPayloadViewProps } from "./LinearPayloadView.tsx";
export { BlockedActionBanner, type BlockedActionBannerProps } from "./BlockedActionBanner.tsx";
export { EnforcementPreview, type EnforcementPreviewProps } from "./EnforcementPreview.tsx";
export { TraceRow, type TraceRowProps } from "./TraceRow.tsx";
export { Card, type CardProps } from "./Card.tsx";
export { ErrorBoundary } from "./ErrorBoundary.tsx";
