## Completed

- Local-search callers now resolve effective source settings and optional grants before search, and the shared search engine invokes only enabled tab, bookmark, or history providers.
- Bookmark/history access moved from install-time permissions to explicit optional permission requests in Settings and the scoped-search buttons. Denials remain off, disabling removes grants, and browser-side revocation updates saved state and active results.
- Removed `scripting` plus DOM metadata/headings extraction. Existing indexes are rebuilt without those fields.
- Retained `<all_urls>` only for automatic visible-tab thumbnail capture, with the exact `activeTab` limitation documented in README and privacy/store-listing guidance.
- Mirrored every runtime/manifest change into `meridian-extension/`.

## Verification

- `node --test --test-concurrency=1 tests/*.test.mjs` - 36 passed, 0 failed.
- `node --check` - every shipped JavaScript file parses.
- `git diff --check` - clean.
- Source/package SHA-256 parity - all changed mirrored files match.