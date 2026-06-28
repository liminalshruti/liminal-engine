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
const SPINE = "^packages/(engine-core|governance|eval-harness|ui-components)/";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "spine-no-live-integrations",
      comment:
        "The demo spine must run on fixtures. Live integrations (gemini/linear/livekit) " +
        "are adapters wired ONLY in apps/ composition root. (DEMO_CONTRACT cut-if-risky / CLAUDE build order.)",
      severity: "error",
      from: { path: SPINE, pathNot: NOT_TEST },
      to: { path: "^packages/integrations/" },
    },
    {
      name: "demo-app-no-live-integrations",
      comment:
        "The demo-spine app (apps/desktop-demo) must run on fixtures only — no live " +
        "integrations (gemini/linear/livekit). It is the demo spine, not the future " +
        "Tauri composition root. (LIM-1163 review Finding 1 / DEMO_CONTRACT 'no live calls on the spine'.)",
      severity: "error",
      from: { path: "^apps/desktop-demo/", pathNot: NOT_TEST },
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
