Implemented thumbnail storage hardening and WebP conversion.

- Added `unlimitedStorage` to the extension manifest.
- Switched tab captures to WebP at quality 55 and custom background resizing to WebP.
- Routed captures through the shared thumbnail cache, capped at 200 entries / approximately 50 MiB with least-recently-captured eviction.
- Kept cache recency metadata synchronized when tabs close.
- Added tests covering WebP resizing, 200-tab cache pruning, and eviction metadata cleanup.

Validation: `node --test` (6/6 passing), `node --check background.js`, `node --check utils/thumbnailCache.js`, manifest JSON parse, and `git diff --check` all passed.