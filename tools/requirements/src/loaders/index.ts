/**
 * Loader registry — maps each `EvidenceSourceType` to the loader that parses it.
 *
 * The seven source types of the EvidenceBundle contract each have exactly one
 * loader. `getLoader` is total over the enum (TypeScript guarantees every case is
 * covered), so routing can never produce a type without a loader.
 */
import type { EvidenceSourceType, SourceLoader } from "../types.ts";
import { transcriptLoader } from "./transcript.ts";
import { proposalLoader, sowLoader } from "./document.ts";
import { emailLoader } from "./email.ts";
import { slackLoader } from "./slack.ts";
import { linearLoader } from "./linear.ts";
import { agentOutputLoader } from "./agent-output.ts";

export const LOADERS: Readonly<Record<EvidenceSourceType, SourceLoader>> = {
  customer_call: transcriptLoader,
  proposal: proposalLoader,
  sow: sowLoader,
  email: emailLoader,
  slack: slackLoader,
  linear: linearLoader,
  agent_output: agentOutputLoader,
};

export function getLoader(sourceType: EvidenceSourceType): SourceLoader {
  return LOADERS[sourceType];
}

export {
  transcriptLoader,
  proposalLoader,
  sowLoader,
  emailLoader,
  slackLoader,
  linearLoader,
  agentOutputLoader,
};
