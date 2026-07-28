## Completed

Removed the confirmed Meridian dead code from both the root source tree and the mirrored `meridian-extension` tree:

- Removed unused search state/API remnants, unreachable non-empty grid filtering, and orphaned injected search styling from `meridian.js`.
- Removed unreachable search glyph constants, unused popup methods, and the unused settings callback parameter.
- Removed obsolete engine/scope, bookmark-button, new-group-button, native-select, and sidebar selectors.
- Retained live hooks including `.scope-chip`, `#bookmarks-panel`, and `#new-group-drop-zone` after confirming their runtime callers.
- Preserved the reachable board-reset behavior in `resetGridFilter()`.

## Verification

- `node --check` passed for all 40 JavaScript files.
- Full test suite passed: 40 tests, 0 failures.
- `git diff --check` passed.
- Root and packaged mirror files remain synchronized.
- Final static audit found none of the removed identifiers/selectors and no unrelated files were changed.