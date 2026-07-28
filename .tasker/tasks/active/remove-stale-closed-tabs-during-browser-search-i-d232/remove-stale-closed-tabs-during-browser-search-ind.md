## Remove stale closed tabs during browser search index rebuild

### Problem
`rebuildIndex()` in `utils/browserSearch.js` merged the current tabs from `chrome.tabs.query({})` into the stored index but never removed entries for tab IDs that were absent. A cold service-worker rebuild therefore retained search entries for tabs that had already been closed, so stale tabs kept showing up in search results.

### Fix
Inside `rebuildIndex()`, within the same serialized `mutateStorageValue(INDEX_KEY, ...)` mutation:
- Build a `Set` of the currently-open tab IDs (`String(tab.id)`, matching the string keys used by the stored index object).
- After seeding/refreshing entries for live tabs (which preserves existing `metaDescription`, `headings`, and `lastActive` via `buildEntry(tab, index[tab.id])`), iterate `Object.keys(index)` and `delete` any entry whose ID is not in the live set.

Because the deletion runs inside the queued mutation, it is serialized against the event-listener writes and is persisted atomically with the rebuild.

### Files changed
- `utils/browserSearch.js` — remove absent tab IDs during rebuild.
- `meridian-extension/utils/browserSearch.js` — packaged mirror kept byte-identical (enforced by `packagedParity.test.mjs`).
- `tests/browserSearchRebuild.test.mjs` — new regression test.

### Regression coverage
`tests/browserSearchRebuild.test.mjs` seeds the index with a live tab (id 7, with metadata + `lastActive`) and a closed tab (id 99). `chrome.tabs.query` returns only tab 7. After `rebuildIndex()` the test asserts:
- entry 99 is removed,
- entry 7 retains its `metaDescription` ("Quarterly roadmap"), `headings`, `lastActive` (111), and `url`,
- only key `7` remains in the index.

### Validation
- `node --test tests/*.test.mjs` → **83 tests pass, 0 fail** (including the new test and `packagedParity`).
- `node --check` over every tracked `.js` file (and the new `.mjs` test) → all pass.
- `git diff --check` → clean (no whitespace errors).