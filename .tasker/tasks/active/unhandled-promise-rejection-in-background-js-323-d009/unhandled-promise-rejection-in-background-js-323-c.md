## Completed

- Guarded `chrome.tabs.update` in `normalizeMeridianTab` so tab attach/detach races resolve without an unhandled rejection.
- Guarded window-scoped tab queries and creation, plus focus activation, when a tab or window disappears mid-flight.
- Mirrored all runtime changes into `meridian-extension/background.js`.
- Added lifecycle regressions covering rejected update, query, create, and activation operations.
- Preserved existing deduplication/restoration behavior; the concurrency, stale replacement, removal restoration, and packaged parity tests all pass.

Validation: `node --test tests/*.test.mjs` — 152 tests passed; `git diff --check` passed.