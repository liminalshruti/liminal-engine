# AGENTS.md — packages/integrations/* (adapters)

Adapters implement governance **ports**. Per `DEMO_CONTRACT.md` cut-if-risky and
`CLAUDE.md` build order: **fixture stubs first, no live calls on the demo spine.**

## Rules
- Each integration implements a port from `@liminal-engine/governance` (e.g.
  `AgentOutputSource`, `LinearWorkstreamPanel`). Keep them swappable.
- Default = fixture/simulated (gemini → fixtures, linear → simulated panel,
  livekit → scripted transcript). A live adapter is a STRETCH goal only, and even
  then it must sit behind the same port so the spine can fall back to fixtures.
- Spine packages (engine-core/governance/eval-harness/ui-components) must NOT
  import these — only the apps/ composition root wires them (enforced:
  `spine-no-live-integrations`).
- No secrets in code. No live network call on any must-not-cut path.
