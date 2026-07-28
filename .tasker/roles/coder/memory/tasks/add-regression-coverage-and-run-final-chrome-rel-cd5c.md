<!-- [task-doc-auto:add-regression-coverage-and-run-final-chrome-rel-cd5c] -->
# Add regression coverage and run final Chrome release validation
_Auto-recorded on completion (2026-07-26T05:22:14.202Z)._

## Completed

Fixed and covered every confirmed reviewer defect, preserved the final search interaction/presentation decisions, synchronized the unpacked release package, and repeated full automated plus Chrome validation.

### Implementation

- Cold service workers now identify a removed pinned Meridian tab from `chrome.storage.local`, clear the stale id, and schedule restoration.
- Refresh-driven tab activation no longer mutates `previousTabId`.
- Workspace assignment and rename storage changes refresh every indexed tab's `workspaceName`.
- Domain clustering now uses the vendored `tldts` 7.4.9 browser ESM bundle with ICANN and private PSL support; its README and MIT license ship in both source and package trees.
- Final search behavior remains intact: retained scoped queries, Enter/magnifier scoped submission, mutually exclusive Bookmark/History toggles with active-icon toggle-off, labeled Web sections, and Web-only empty-local results without the obsolete empty message.

### Regression evidence

The new focused tests were run before implementation and produced 14 passes / 5 failures. The failures covered cold-worker restoration, refresh activation tracking, workspace metadata, ICANN suffixes, and private suffixes. The post-fix focused run passed all 19 assertions. Additional behavioral coverage exercises Web-only rendering and Web provider launch/query clearing.

### Final automated validation

- `node --test tests/*.test.mjs` - 53 passed, 0 failed.
- `node --check` - all 42 runtime JavaScript files passed.
- Root/package parity - passed, including all vendored PSL assets.
- Third-party favicon fallback scan - 0 shipped-runtime matches.
- `git diff --check` - passed.

### Unpacked Chrome validation

Loaded `meridian-extension/` in a new Chrome for Testing 151.0.7922.47 profile. Verified startup, labeled local/Web search and clearing, `/` and Escape focus behavior, settings and Dark-theme persistence across reload, native grouping, Enter/Escape/blur rename behavior, live workspace index updates, two HTTPS thumbnail captures with unchanged `previousTabId`, side-panel search and Enter activation, and storage cleanup.

The service worker was confirmed idle before the stored pinned Meridian tab was closed. A new worker started and recreated the pinned tab with a new stored id, validating the cold-worker path. Extension-page, side-panel, original-worker, and restarted-worker diagnostics contained no errors or warnings. Exact commands, ids, results, cleanup state, and risks are recorded in `RELEASE_VALIDATION.md`.

### Remaining release blockers/risks

No code or automated-test blocker remains. Chrome Web Store submission is still blocked on publisher-side verification of the public privacy-policy URL, Store data-use declarations, permission justifications, listing disclosures, and exact submitted-archive audit. Broad host access and stored visible-page screenshots remain review-scrutiny risks. The vendored `tldts` license must remain in the archive and its PSL data should be refreshed periodically.
