Run the smoke test for the Liminal Engine governance hack.

1. Execute `./scripts/smoke.sh`.
2. Run any available build/test commands it reports.
3. Walk the manual demo checklist it prints, confirming each item is visibly
   present in the running demo.
4. Report which checklist items pass and which fail, and whether the full
   required demo path completes in under 3 minutes.

Do not mark the demo ready unless every must-not-cut item in `DEMO_CONTRACT.md`
is present and the eval table shows Fail → Pass.
