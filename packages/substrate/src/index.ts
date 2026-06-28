/**
 * @liminal-engine/substrate — a versioned snapshot schema for agent consumption.
 *
 * Pre-built for post-hack agent-runs. Agents read substrate snapshots to verify
 * governance state, chain corrections, and prove improvement over time.
 *
 * No integrations here — pure schema + fixtures. The governance loop writes
 * substrates via the contracts canonical hash; agents consume them for replay/audit.
 */

export { substrateContract, substrateShape, SUBSTRATE_SCHEMA, type Substrate } from "./substrate.contract.ts";
export { substrateGoldenVectors } from "./substrate.contract.ts";
export {
  ACME_SUBSTRATE_SEQUENCE,
  GOVERNANCE_LOOP_SUBSTRATE_CHAIN,
} from "./fixtures.ts";
