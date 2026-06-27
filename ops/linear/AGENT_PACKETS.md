# Linear — Agent Packets

> Placeholder. File-boundary-scoped work packets for parallel agent dispatch.
> Each packet should own non-overlapping files to avoid merge conflicts.

## Packet template

```
### Packet: <name>
- Owns files: <explicit paths — no overlap with other packets>
- Reads (context only): <paths>
- Deliverable: <one screen / one fixture set / one stub>
- Acceptance: <maps to a DEMO_CONTRACT.md acceptance item>
- Must NOT: redesign product / invent persona / make dashboard hero / touch other packets' files
```

## Packets (fill in before dispatch)

_(none yet — define after the demo spine structure is laid out)_
