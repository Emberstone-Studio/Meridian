<!-- [task-doc-auto:gate-local-search-data-access-and-minimize-exten-e0ab] -->
# Gate local search data access and minimize extension permissions
_Auto-recorded on completion (2026-07-26T04:40:12.689Z)._

## Completed

- Optional bookmark/history search now requires both an explicit saved `true` preference and the corresponding Chrome permission. Missing preferences remain disabled even if an old grant exists, and no permission inspection or underlying search occurs for those sources.
- Restored the shipped one-shot page metadata extractor for completed tabs in both source and packaged trees. Meta descriptions and H1/H2 headings are retained in the local tab index and contribute to search scoring.
- Restored the required installed `scripting` permission while keeping `bookmarks` and `history` optional. Persistent `<all_urls>` and `scripting` are documented with the exact automatic thumbnail/metadata-indexing justification.
- Updated README, privacy/store-listing guidance, release validation notes, manifest assertions, optional-permission regression coverage, and metadata-extraction coverage.

## Verification

- `node --test --test-concurrency=1 tests/*.test.mjs` - 43 passed, 0 failed.
- `node --check` - all 40 shipped JavaScript files parsed.
- Source/package SHA-256 parity - all changed mirrored files match.
- `git diff --check` - clean.
