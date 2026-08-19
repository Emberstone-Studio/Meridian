Fixed the runaway second-window navigation loop.

- Added a per-tab re-entrancy guard around managed Meridian tab restoration.
- Re-read live tab state so stale URL update callbacks cannot reopen destinations.
- Restore the managed Meridian tab before creating exactly one destination tab in the same window.
- Mirrored the fix into `meridian-extension/background.js`.
- Added regression coverage for concurrent duplicate updates and stale post-restoration updates.

Validation: `node --test tests/*.test.mjs` passes all 142 tests; source/package parity, syntax, and `git diff --check` also pass.