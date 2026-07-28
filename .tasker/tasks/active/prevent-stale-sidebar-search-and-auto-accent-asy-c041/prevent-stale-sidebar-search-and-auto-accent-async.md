Implemented latest-update-wins protection for both async pipelines.

- Added a sidebar search generation that advances on every input change and Escape clear. Search DOM writes now require both the captured generation and query to still be current, including after the provider lookup.
- Added an accent-analysis generation that guards delayed custom URL resolution, image sampling, cached dominant color/luminance, and derived CSS writes.
- Updated storage-triggered appearance handling to start the newest accent request immediately and prevent delayed custom-background resolution from applying an older appearance.
- Kept the root sources and `meridian-extension` mirror synchronized.
- Added reversed-completion regressions for old/new sidebar searches, clear-during-search, the no-results provider await, image loads, and custom URL resolution.

Validation:
- `node --check` passed for changed runtime sources.
- Full suite: 23 tests passed.
- `git diff --check` passed.
- Commit: `8b546b4 Prevent stale async appearance and search results`