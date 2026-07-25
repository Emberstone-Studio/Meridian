Implemented serialized `chrome.storage.local` read-modify-write operations across the affected state paths.

- Added a reusable per-key mutation queue that remains usable after failed mutations.
- Routed tab search event updates, metadata extraction, removal/activation updates, and startup rebuilding through the queue. Startup rebuilding now merges queried tabs into the latest queued index.
- Routed workspace and assignment mutations through the same helper, including schema normalization/initialization.
- Serialized `tabOrder` reorders and `collapsedLanes` toggles.
- Added regression coverage simulating 20 concurrent index mutations and queue recovery after failure.

Validation:
- `node --test tests/storageMutationQueue.test.mjs` - 2 tests passed.
- `node --check` across all JavaScript under `utils/` and `components/` - passed.
- `git diff --check` - passed (line-ending notices only).