/**
 * Boundary enforcement for Liminal Engine — makes the locked CLAUDE.md /
 * DEMO_CONTRACT.md rules a FAILING BUILD, not a paragraph.
 *
 * Layering (inner → outer):
 *   contracts  ←  engine-core (domain)  ←  governance (application)  ←  ui-components / apps
 *                                            ↑ ports
 *   packages/integrations/* = live adapters — used ONLY from apps/ composition root.
 *
 * THE big one (`spine-no-live-integrations`) mechanically enforces
 * "fixtures before integrations · no live calls on the demo spine".
 * Test files (*.test.ts) are exempt from `from`.
 */

const NOT_TEST = "\\.(test|spec)\\.ts$";

// The LIVE integrations the demo spine must never call (DEMO_CONTRACT cut-if-risky).
// The OTHER integrations (in-memory fixture stores + the deterministic clock/idgen)
// are fixture-backed and ARE allowed at the apps/ composition root so the app can
// run the real governance loop over them (LIM-1245 — UI renders real loop output,
// not raw fixtures). The spine itself still may not import ANY integration.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "engine-core-no-integrations",
      comment:
        "The pure DOMAIN (engine-core) must not import any integration adapter — it " +
        "stays I/O-free and testable. Live integrations are wired by the application " +
        "(governance) + the app composition root. " +
        "[DIRECTIVE.md: build a real product on live integrations; only engine-core " +
        "stays pure — the demo-flow 'no live calls on the spine' constraint is removed " +
        "so the product can run real gemini/linear/livekit end to end.]",
      severity: "error",
      from: { path: "^packages/engine-core/", pathNot: NOT_TEST },
      to: { path: "^packages/integrations/" },
    },
    {
      name: "engine-core-is-domain",
      comment: "engine-core is the innermost domain: it may import @liminal-engine/contracts only — not governance/eval/ui/integrations.",
      severity: "error",
      from: { path: "^packages/engine-core/", pathNot: NOT_TEST },
      to: { path: "^packages/(governance|eval-harness|ui-components|integrations)/" },
    },
    {
      name: "engine-core-no-node-core",
      comment: "Domain must be pure — no node core modules (no fs/http/etc). Do I/O via ports in adapters.",
      severity: "error",
      from: { path: "^packages/engine-core/", pathNot: NOT_TEST },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "ui-calls-application",
      comment: "UI calls governance (application) + contracts — not engine-core domain internals.",
      severity: "error",
      from: { path: "^packages/ui-components/", pathNot: NOT_TEST },
      to: { path: "^packages/engine-core/" },
    },
    {
      name: "contracts-are-leaf",
      comment: "contracts/ is the shared kernel — it may not depend on any other package.",
      severity: "error",
      from: { path: "^packages/contracts/", pathNot: NOT_TEST },
      to: { path: "^packages/(engine-core|governance|eval-harness|ui-components|integrations)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
      exportsFields: ["exports"],
      conditionNames: ["import", "node", "default"],
    },
  },
};
