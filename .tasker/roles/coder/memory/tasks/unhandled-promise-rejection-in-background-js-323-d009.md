<!-- [task-doc-auto:unhandled-promise-rejection-in-background-js-323-d009] -->
# Unhandled promise rejection in background.js:323 (chrome.tabs.onAttached → normalizeMeridianTab)
_Auto-recorded on completion (2026-08-19T19:51:01.895Z)._

## Completed

- Guarded `chrome.tabs.update` in `normalizeMeridianTab` so tab attach/detach races resolve without an unhandled rejection.
- Guarded window-scoped tab queries and creation, plus focus activation, when a tab or window disappears mid-flight.
- Mirrored all runtime changes into `meridian-extension/background.js`.
- Added lifecycle regressions covering rejected update, query, create, and activation operations.
- Preserved existing deduplication/restoration behavior; the concurrency, stale replacement, removal restoration, and packaged parity tests all pass.

Validation: `node --test tests/*.test.mjs` — 152 tests passed; `git diff --check` passed.
