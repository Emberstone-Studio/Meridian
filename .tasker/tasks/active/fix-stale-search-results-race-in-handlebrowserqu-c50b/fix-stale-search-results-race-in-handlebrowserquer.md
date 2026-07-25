Implemented a monotonic browser-search sequence guard in `meridian.js`.

- Each `handleBrowserQuery()` call captures a new sequence number before asynchronous work begins.
- After `search()` and the settings lookup resolve, an invocation exits unless it is still active and still the newest query.
- This prevents an older query from updating `browserSearchResults` or calling `renderSearchResults()` after a newer query has started.

Validation:
- `node --check meridian.js` passed.
- `git diff --check` passed.
- Reviewed the concurrent ordering paths, including clearing search and starting a new query while an older request remains pending.