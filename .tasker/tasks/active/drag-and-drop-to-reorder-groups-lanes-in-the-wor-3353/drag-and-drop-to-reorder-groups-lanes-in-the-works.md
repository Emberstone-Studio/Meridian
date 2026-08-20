Implemented lane-level reordering across the workspace.

- Added a dedicated draggable lane-header handle with a lane-sized dashed placeholder, drag-state cleanup, and Up/Down keyboard reordering.
- Kept lane and tab drag state separate so tab reordering, cross-lane tab moves, and the new-group drop zone retain their existing behavior.
- Persisted `laneOrder` in shared `chrome.storage.local`, restored it during render, preserved temporarily hidden lanes, and rerendered every open window on storage changes.
- Mirrored all runtime changes into `meridian-extension/`.
- Added focused coverage for mouse/drop behavior, keyboard behavior, persistence ordering, hidden lanes, cross-window rerenders, and tab-drag isolation.

Verification:
- `node --test tests/*.test.mjs`: 165 passed, 0 failed.
- `git diff --check`: passed.
- Source/package parity checks: passed.
- Headless Chrome DOM smoke: draggable handles rendered with accessible labels; ArrowDown reordered and retained focus; mouse drag activated the placeholder, committed lane order, and cleaned up drag state.