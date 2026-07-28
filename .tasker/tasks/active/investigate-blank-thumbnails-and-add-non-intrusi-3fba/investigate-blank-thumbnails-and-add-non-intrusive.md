## Result

Confirmed the in-session loss path: the cache pruned a metadata-only global LRU without checking current Chrome tab IDs. Crossing 200 entries or 50 MB therefore deleted older thumbnails for still-open tabs, matching the observed old placeholders/new survivor pattern. It also removed prior entries before the incoming storage write, so a quota/write failure could leave a partially deleted cache. Full-window JPEG storage accelerated byte pressure.

## Fix

- Reconciled `thumb_*` values and `thumbnailCacheAccess` on every save, recalculating actual UTF-8 stored bytes and serializing the complete cache mutation.
- Protected all live-tab thumbnails. Closed/orphaned entries are pruned first; if live entries alone exceed a limit, the limit is a deterministic soft cap rather than silently deleting live screenshots.
- Made the incoming thumbnail plus reconciled metadata write succeed before orphan cleanup. Failed refresh, resize, focus guard, or storage writes preserve the prior valid thumbnail.
- Resized captures to a maximum 960�600 JPEG before storage and rechecked the active tab after processing.
- Added per-window deduplicated lazy recovery when a missing tab naturally becomes active or completes loading while active. It never activates a tab and is bounded to three attempts with 750/1500 ms backoff. Existing thumbnails are not recaptured merely on activation; completed navigation refreshes once.
- Added card image-error handling that immediately renders an honest letter placeholder and compare-and-removes only the exact corrupt cached value, protecting a newer concurrent replacement.
- Added structured cache/lifecycle diagnostics covering live tab IDs, stored keys, metadata keys, byte totals, prune decisions, and removal/load events.
- Mirrored every runtime change into `meridian-extension`; no permissions were added.

## Regression coverage

Added deterministic coverage for entry and byte pressure, live soft-cap behavior, orphan-first pruning, metadata reconciliation, accurate byte accounting, concurrent saves, incoming write/removal failures, close/removal lifecycle, discarded/frozen/navigation events, focus races, capture resizing and decode failures, image load errors, compare-and-remove safety, retry bounds, and no-focus-change behavior.

## Validation

- `node --test tests/*.test.mjs`: **107 passed, 0 failed**
- `node --check` for every JavaScript file: **passed**
- Packaged source parity: **passed**
- `git diff --check`: **passed**
- Commit: `8c97ad0 Protect live thumbnails and add lazy recovery`