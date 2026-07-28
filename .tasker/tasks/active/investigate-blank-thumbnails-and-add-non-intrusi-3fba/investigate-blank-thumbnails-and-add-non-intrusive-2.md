## Result

Completed the reviewer-requested hardening for the thumbnail-loss fix.

- Routed corrupt-image conditional cleanup from `TabCard` to the background service worker via `REMOVE_THUMBNAIL_IF_MATCHES`. Capture saves and failed-image cleanup now use the same background `thumbnailCacheAccess` mutation queue, eliminating the cross-context read/compare/remove race that could delete a newly saved replacement.
- Kept compare-and-remove semantics: cleanup removes only the exact failed data URL and leaves a newer thumbnail intact.
- Gated cache-decision diagnostics behind explicit `DEBUG_THUMBNAILS` mode and reduced debug payloads to counts and byte totals instead of tab IDs, storage keys, and removal key lists.
- Mirrored runtime changes into `meridian-extension`.
- Updated the card error regression to verify background routing and added a save-versus-failed-image-cleanup race regression.

## Validation

- `node --test tests/*.test.mjs`: **113 passed, 0 failed**
- `node --check` across all 52 tracked JavaScript files: **passed**
- Packaged runtime parity test: **passed**
- Manifest parsing: **passed**
- `git diff --check`: **passed**
- Worktree: **clean**
- Commit: `ce680d7 Serialize corrupt thumbnail cleanup`