# IP_RECEIPT.md — provenance & prior-work boundary

Tracks what in this folder is **net-new hackathon work** vs **adapted prior
work**, so the IP story and the hackathon net-new claim are both defensible.

## Net-new (built during the hackathon, in this folder)

- All scaffold docs and structure (this session).
- `apps/desktop-demo/**` (React+Vite demo spine shell) — except the vendored
  `design-tokens.css` (see adapted-work table). The 14-step stepper, the
  step→fixture binding, and all layout CSS are net-new.
- `JUDGING_MAP.md` (LIM-1157) — rubric→thesis→demo-beat mapping.
- _To be appended as the build proceeds._

## Adapted / referenced prior work

Any file containing code adapted from a prior Liminal repo MUST carry the header:

```text
// ADAPTED FROM: <repo>/<path> — prior work, not built during hackathon
```

List each such file here as it's added:

| File | Source repo/path | What was adapted |
|------|------------------|------------------|
| `apps/desktop-demo/src/styles/design-tokens.css` | `liminal-prototype/design-system/tokens/design-tokens.css` | Canonical Liminal design tokens (color/type/spacing/motion), vendored verbatim with an `ADAPTED FROM` banner. Single source of truth for the demo's visual register. Prior Liminal work, authored by Shruti Rajagopal — MIT-compatible (same owner). |

## Entity status

The Liminal company entity is not yet incorporated.

Do not refer to this project as owned by `Liminal, Inc.` until incorporation is complete and rights have been assigned appropriately.

For the hackathon MIT license, use:

`Copyright (c) 2026 Shruti Rajagopal and contributors`

This can be updated later after incorporation and assignment if appropriate.

## License

- This folder is published under **MIT** (`LICENSE`), copyright **Shruti
  Rajagopal and contributors**. The company entity is not yet incorporated;
  until incorporation and IP assignment are complete, this hackathon repository
  uses Shruti Rajagopal and contributors as the open-source copyright holder.
- Confirm any adapted prior-work snippets are compatible with MIT redistribution
  before publishing publicly.

## Prior repos referenced for context only (NOT copied)

- `liminal-prototype` — persona / ICP / product narrative (persona extraction TODO).
  **Exception:** its canonical `design-tokens.css` IS vendored into the demo app
  (see the adapted-work table above) — that one file is copied, the rest is
  reference-only.
- `liminal-desktop`, `liminal-govern`, `liminal-agents` — vocabulary & design
  language reference.

> If nothing from a prior repo is copied, that's the cleanest story: this folder
> is 100% net-new. Keep it that way unless there's a strong reason to adapt.
