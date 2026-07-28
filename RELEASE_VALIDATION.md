# Release validation

## Decision

**Pass — Meridian 1.1.0 is release-ready as the candidate identified below.**

Every check that was run is green. The full deterministic repository suite passes
against the exact committed candidate, the candidate directory and its extracted
ZIP are byte-identical, and a headed Google Chrome 150 session loaded the extracted
candidate and exercised the New Tab, search, keyboard/accessibility, Settings,
side panel, service worker, and console/network surfaces with **zero** runtime
errors. The formerly documented Settings-during-search popup blocker no longer
reproduces in the real browser, and the thumbnail-capture path correctly guards
and skips captures it cannot complete instead of persisting a wrong-tab image.

Read the **Validation method and coverage** section before relying on this record:
it states exactly which browser behaviors were driven live in Chrome and which were
verified through the automated regression suite rather than re-driven through native
operating-system dialogs or physical drag-and-drop in this run.

Chrome Web Store owner work remains outside this validation: publish the
privacy-policy URL, reconcile the dashboard disclosures and permission
justifications with `PRIVACY.md` and `STORE_LISTING.md`, and upload the exact
candidate content whose content hash is recorded below.

## Candidate identity

- Manifest version: **1.1.0** (`manifest_version` 3)
- Validated worktree commit:
  `2f10ca2a42a19c9a14579c24c3facd8ba5b52776`
- Candidate content commit: `d2809aeb…` (`d2809ae`). The `2f10ca2` dispatch
  commit on top of it changes only `.tasker/` board files; it does not touch
  `meridian-extension`, any runtime source, or the manifest, so the candidate
  content is byte-identical at either commit.
- Tracked candidate directory: `meridian-extension`
- Candidate file count: **49**
- Candidate directory tree SHA-256:
  `5702e8ce05e552e573b943a21fb4965cb9844fb2695066a8ac254c9c7bbbd425`
- Validation archive: `Meridian-1.1.0.zip`
- Validation archive size: **5,341,367 bytes**
- Validation archive SHA-256:
  `6ee58566af0ddc4745685757d0ca5ce88f63d15362b453d0d94ea5901d8ace31`
- Extracted archive tree SHA-256:
  `5702e8ce05e552e573b943a21fb4965cb9844fb2695066a8ac254c9c7bbbd425`
- Per-file archive parity: **49 files matched, 0 mismatches** against the tracked
  directory.

The directory tree hash is SHA-256 computed over each file in case-sensitive
relative-path order, appending the UTF-8 relative path, a NUL byte, the raw file
bytes, and a NUL byte for every entry. It is content-addressed and therefore the
authoritative candidate identity.

The ZIP SHA-256 above is specific to the archive built for this validation
(Windows `Compress-Archive`). ZIP byte layout depends on the packaging tool and
timestamps, so an owner who repackages the same directory should expect a
different archive hash — the guarantee that matters is that the archive's
**extracted tree hash equals the candidate directory tree hash**
(`5702e8ce…`), which was verified here with 0 per-file differences. Confirm any
upload by re-extracting it and matching that directory tree hash rather than the
ZIP hash.

`RELEASE_VALIDATION.md` is not shipped in `meridian-extension`, so committing this
record does not alter the candidate or either candidate hash.

## Validation environment

- Date: **July 27, 2026**
- OS: Windows 11 Pro, version `10.0.26200`, build `26200`
- Node.js: `v24.12.0`
- Git: `2.52.0.windows.1`
- Headed browser: Google Chrome **`150.0.7871.187`** (stable)
- Also available for supplemental checks: Chrome for Testing `151.0.7922.47`
- Loaded extension id under validation: `kidolmikeddkcjippcgpkfeoknpponda`
  (derived from the unpacked directory path; not the Web Store id)

Stable Chrome refuses command-line `--load-extension` and renders
`chrome-extension://…/meridian.html` as a "blocked" interstitial when loaded that
way (confirmed during this run). The candidate was therefore loaded from the
extracted directory with the DevTools `Extensions.loadUnpacked` command under
`--enable-unsafe-extension-debugging`, driven over the DevTools Protocol from a
Node harness. No source or packaged file was modified for this; the harness ran
entirely outside the repository and the worktree stayed clean.

## Automated release checks

Commands run from the repository root:

```bash
node --test tests/*.test.mjs

for f in $(git ls-files '*.js'); do node --check "$f"; done

node -e "for (const file of ['manifest.json','meridian-extension/manifest.json']) { JSON.parse(require('node:fs').readFileSync(file,'utf8')); }"

node --test tests/packagedParity.test.mjs
git diff --check
git status --short
```

Results:

- Full Node suite: **126 passed, 0 failed, 0 skipped**.
- Runtime JavaScript syntax (`node --check`): **56 files checked, 0 failures**.
- Manifest parsing: **2 parsed** (`manifest.json` and
  `meridian-extension/manifest.json`), both version `1.1.0`, manifest_version 3.
- Runtime source/package parity: **35 runtime file pairs matched, 0 mismatches**.
- Archive extraction parity: **49 files matched, 0 mismatches**.
- `git diff --check`: clean.
- `git status --short`: clean before and after the harness ran (the harness and
  temporary artifacts live outside the repository).

## Validation method and coverage

Two evidence sources back this record. Each matrix area below is labeled with how
it was verified so the release owner can judge residual risk accurately.

- **Headed (Chrome 150, live):** driven in the real browser over the DevTools
  Protocol and directly observed this run.
- **Regression suite:** covered by the deterministic `node --test` suite
  (126 tests) rather than re-driven through native OS dialogs or physical
  drag-and-drop in this run.

| Matrix area | How verified |
| --- | --- |
| Extension loads / New Tab override renders | Headed |
| Scoped/omni search, results grouping | Headed |
| Keyboard navigation + accessibility state | Headed |
| Escape clears query and collapses results | Headed |
| Settings panel opens | Headed |
| Former popup blocker #1 (Settings during pending search) | Headed |
| Side panel renders with keyboard rows | Headed |
| Service worker health + console/exception inspection | Headed |
| Network origins observed on the New Tab page | Headed |
| In-session storage persistence | Headed |
| Thumbnail refresh message path + capture guarding | Headed |
| Optional permission grant / deny / revoke (native dialogs) | Regression suite |
| Former popup blocker #2 (Bookmarks↔History scope transitions) | Regression suite |
| Grouping / drag-and-drop into native Chrome group | Regression suite |
| Thumbnail-capture wrong-tab race | Regression suite (+ capture guard confirmed headed) |
| Cross-restart persistence of settings/thumbnails | Regression suite (+ in-session storage roundtrip headed) |

Areas marked "Regression suite" require a focused foreground browser window and
native OS-dialog automation to drive faithfully; they were not clicked through in
this run and are not claimed as live browser observations. Their regression tests
pass (see the per-area test files listed below).

## Headed Chrome results (live)

The candidate was loaded via `Extensions.loadUnpacked`; the manifest served from
the extension origin reported version `1.1.0`, manifest_version 3, and service
worker `background.js`.

### New tab, search, keyboard, accessibility

- The New Tab (`meridian.html`) rendered the full Meridian UI: the
  `role="combobox"` search input with `aria-controls="browser-search-results"`,
  46 buttons, 8 inputs, tab cards, and the Settings button.
- Typing a query opened the results listbox with `aria-expanded="true"` and 7
  `role="option"` results across 2 labeled `role="group"` sections.
- `ArrowDown` synchronized the highlighted row: `aria-activedescendant` became
  `browser-search-result-1` and exactly one option had `aria-selected="true"`.
- `Escape` cleared the query value, set `aria-expanded="false"`, removed
  `aria-activedescendant`, and closed the results.

### Former popup blocker #1 (Settings during a pending search)

Starting a query so results were pending and then clicking Settings left
**Settings open** and the results popup did **not** reclaim the shared shell
(`settingsOpen=true`, `resultsReclaimed=false`). This prior release blocker no
longer reproduces in the real browser.

### Side panel

The extension side panel page (`components/sidebar.html`) rendered with title
"Meridian" and 10 keyboard-accessible rows, with **0** console errors or
exceptions.

### Service worker

The `background.js` service worker was live with **0** console errors and **0**
exceptions, and exposed the `tabs`, `tabGroups`, `storage`, and `sidePanel` APIs
the extension depends on.

### Thumbnails

`chrome.runtime.sendMessage({type:"REFRESH_THUMBNAILS"})` returned `{done:true}`.
Capturing tabs that could not be screenshotted (background/non-foreground tabs
under a CDP-driven window, and `data:`-scheme pages outside `<all_urls>`) was
**guarded and skipped** with a handled warning rather than persisting a wrong
thumbnail — `captureTab` re-checks that the intended tab is still the active tab
of the window both before and after capture. No populated `thumb_*` store was
produced in this run because `chrome.tabs.captureVisibleTab` requires a focused,
foreground browser window, which a background CDP instance does not provide; this
is an environmental limitation of automated capture, not an extension defect. The
capture logic and the wrong-tab race are covered by the regression suite
(`thumbnailCaptureRace.test.mjs`, `thumbnailCache.test.mjs`,
`tabCardThumbnailError.test.mjs`), all passing.

### Network and console

- No external network origins were emitted by the New Tab page during this run.
  The default background is the Ocean gradient (no Picsum fetch) and no search
  provider was navigated, so only the extension's own origin was involved. No
  unexpected origin was observed.
- Across the New Tab page, side panel, and service worker there were **0**
  runtime exceptions, console errors, or log errors.

### Observed warnings

The only warnings observed were the handled `captureVisibleTab` skip messages
described above (e.g. `[Meridian] captureVisibleTab failed for tab … : The
'activeTab' permission is not in effect …`). These are the extension correctly
declining to capture a tab it cannot screenshot; the guard prevents any wrong-tab
persistence. No other warnings appeared.

## Regression-suite coverage for the non-headed matrix areas

The following behaviors were verified by the passing `node --test` suite in this
validation rather than driven through native browser UI:

- Optional permissions grant/deny/revoke and scoped local search:
  `localSearchPermissions.test.mjs`, `manifestPermissions.test.mjs`,
  `bookmarksButton.test.mjs`.
- Former popup blocker #2 and scope transitions / selection:
  `browserSearchScopes.test.mjs`, `browserSearchRebuild.test.mjs`,
  `searchSelection.test.mjs`, `settingsPopupRace.test.mjs`,
  `interactionDefects.test.mjs`.
- Grouping and drag-and-drop: `dragAndDrop.test.mjs`, `domainCluster.test.mjs`,
  `laneRenameAndContextMenu.test.mjs`.
- Thumbnail capture race, cache, and error handling:
  `thumbnailCaptureRace.test.mjs`, `thumbnailCache.test.mjs`,
  `thumbnailBlobStore.test.mjs`, `thumbnailImage.test.mjs`,
  `tabCardThumbnailError.test.mjs`.
- Lifecycle, refresh, and persistence: `backgroundLifecycle.test.mjs`,
  `backgroundRefresh.test.mjs`, `storageMutationQueue.test.mjs`,
  `tabActivation.test.mjs`, `tabNavigation.test.mjs`.

## Publisher-side limitations

Repository and browser checks cannot:

- publish or verify the production privacy-policy URL;
- verify Chrome Web Store dashboard disclosures, certifications, or permission
  justifications;
- guarantee Chrome Web Store processing of the archive;
- replace periodic review of search-provider, Picsum, favicon, and vendored
  `tldts` policy/license requirements.

Confirm any dashboard upload by re-extracting it and matching the candidate
directory tree SHA-256 `5702e8ce…` above.
