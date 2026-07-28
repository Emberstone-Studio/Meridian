## Completed

- Reworked lane rename handling so ordinary keystrokes no longer remove the Enter/Escape listener.
- Unified Enter, Escape, and blur finalization with listener cleanup, single-commit behavior, and exact original-title restoration on Escape.
- Cleared the old Meridian workspace assignment after a native group is created and before the lane rename event is dispatched.
- Added focused regressions covering Enter after typing, Escape restoration, blur deduplication, and native-group assignment cleanup/order.

## Verification

- `node --test tests/laneRenameAndContextMenu.test.mjs` - 4 passed.
- `node --test` - 27 passed.
- `node --check components/WorkspaceLane.js` and `node --check components/ContextMenu.js` - passed.
- `git diff --check` - passed.