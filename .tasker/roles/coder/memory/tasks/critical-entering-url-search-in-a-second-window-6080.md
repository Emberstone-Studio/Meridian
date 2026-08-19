<!-- [task-doc-auto:critical-entering-url-search-in-a-second-window-6080] -->
# CRITICAL: entering URL/search in a second window opens infinite Meridian tabs
_Auto-recorded on completion (2026-08-19T18:59:28.686Z)._

Fixed the runaway second-window navigation loop.

- Added a per-tab re-entrancy guard around managed Meridian tab restoration.
- Re-read live tab state so stale URL update callbacks cannot reopen destinations.
- Restore the managed Meridian tab before creating exactly one destination tab in the same window.
- Mirrored the fix into `meridian-extension/background.js`.
- Added regression coverage for concurrent duplicate updates and stale post-restoration updates.

Validation: `node --test tests/*.test.mjs` passes all 142 tests; source/package parity, syntax, and `git diff --check` also pass.
