/**
 * Shared UI components for the demo spine.
 * Each component is typed against the contracts and deterministic fixtures.
 * No live calls on the spine — all components render from fixture data.
 *
 * Screens import from this barrel:
 *   import { StatusBadge, Card } from "../components";
 */

export { StatusBadge, type StatusBadgeProps } from "./StatusBadge.js";
export { EvalTable, type EvalTableProps } from "./EvalTable.js";
export { LinearPayloadView, type LinearPayloadViewProps, type LinearWorkstreamIssue } from "./LinearPayloadView.js";
export { BlockedActionBanner, type BlockedActionBannerProps } from "./BlockedActionBanner.js";
export { TraceRow, type TraceRowProps } from "./TraceRow.js";
export { Card, type CardProps } from "./Card.js";
