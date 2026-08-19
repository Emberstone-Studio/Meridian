<!-- [task-doc-auto:do-not-persist-stale-meridian-tab-ids-after-norm-1b57] -->
# Do not persist stale Meridian tab IDs after normalization failure
_Auto-recorded on completion (2026-08-19T20:19:49.896Z)._

Implemented the stale Meridian tab normalization fix.

- `normalizeMeridianTab` now returns `null` immediately when `chrome.tabs.update` rejects, preventing any subsequent move or persistence of the stale tab.
- Mirrored the worker change in `meridian-extension/background.js`.
- Updated lifecycle regression coverage to assert the vanished tab is neither moved nor remembered and that normalization reports `null`.
- Existing ensure, focus, and event callers already tolerate the null sentinel.

Verification:
- Targeted lifecycle scenarios (restoration, per-window ensure, navigation handoff, replacement/deduplication): 4/4 passed.
- Packaged runtime parity: 1/1 passed.
- Full test suite: 156/156 passed.
- Syntax checks for both background workers passed.
- Diff whitespace check passed.
