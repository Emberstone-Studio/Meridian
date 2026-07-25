Implemented failure-safe thumbnail refresh behavior.

- Each tab refresh is isolated so a failed activation/capture does not abort the remaining sweep.
- Original active tabs are restored from `finally`, before `isRefreshing` is cleared.
- The `REFRESH_THUMBNAILS` responder now sends `{ done: false }` when setup or refresh fails, ensuring callers settle.
- Added regression coverage for a mid-loop tab failure, continued capture, and restoration across windows.

Verification: `node --test tests/*.test.mjs` (9 passing); `git diff --check` passed.