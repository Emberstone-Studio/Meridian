## Completed

Implemented full keyboard selection navigation for Meridian search results in both the root source and `meridian-extension` mirror.

- Added a shared popup selection controller with wrapped Up/Down movement, one visible active row, nearest-row scrolling, pointer synchronization, activation, and safe reset behavior.
- Routed Enter and the magnifier through the highlighted row first while preserving default web/scoped submit behavior when no row is selected.
- Integrated selection across Open Tabs, Bookmarks, History, Web, and scoped bookmarks/history popups.
- Reset selection on query/scope changes, popup open/close, content rendering, async result replacement, and clearing.
- Preserved existing Escape/query behavior, direct URL recognition, and pinned-versus-unpinned navigation.
- Added regression coverage for Up/Down wrapping, cross-section traversal, Enter/magnifier activation, async replacement, empty results, pointer synchronization, and scoped popup rows.

Validation: `node --test` - 69 passed, 0 failed. `git diff --check` passed. Root/mirror parity passed.