# Release validation

## Decision

**Pass — the Meridian candidate identified below is release-ready from a
repository, package-integrity, and headed-browser perspective.**

The full deterministic suite still passes, the source/package parity check is
green, and the regenerated ZIP extracts to the exact candidate tree hash. The
prior full validation's fresh headed Google Chrome 151 profile loaded the New Tab
override and exercised the new and previously release-critical behavior with zero
page or side-panel runtime exceptions, console errors, or log errors.

This record layers a version-bump-only re-verification on that prior full
validation. No headed Chrome pass was repeated because
`git diff 970421f7eaf3a319e4696c23ac5714535617e6cc..5674a8bcd4d457ee97ebf479264e9695809ae114 -- manifest.json meridian-extension/manifest.json`
changes only the two manifest `version` strings from `1.1.0` to `1.2.0`; no
functional candidate file changed.

The prior `asyncLatestWins.test.mjs` failure was a stale test expectation. Commit
`2d626f6` intentionally made the sidebar Bookmarks and History chips pure filters
for sources already enabled in Settings; the test still expected a chip click to
request permission. The test now asserts the intended no-permission-request
contract and passes.

Publisher work remains outside this validation. The prior manifest-version
recommendation has now been applied; see **Manifest version decision** below.

## Changes since the previous validation

The previous record covered candidate commit `d2809ae`. The candidate now also
contains:

- `d1ace2d`: Emberstone Studio footer, History quick-open action, custom-image
  tile polish, and search-popup sizing changes.
- `2d626f6`: removal of redundant settings status text and scope-chip visibility
  synchronized with enabled optional permissions.
- `ee61850`: privacy disclosure copy aligned with the **Thumbnails** control.
- `55b9e0b`: bundled `img/aurora.webp` as the default background, plus photo
  transparency, blur, and fade controls.
- `f4e05ff`: in-product privacy-policy link and release-document updates.
- Dispatch baseline `970421f`: the privacy link was corrected to the
  product-specific `https://emberstone-studio.com/docs/privacy/meridian`; public
  privacy, store-listing, and release documents moved under `docs/` with updated
  cross-references.
- This validation run: the obsolete permission-grant expectations in
  `tests/asyncLatestWins.test.mjs` were corrected. This test-only change does not
  alter the shipped extension tree.
- Version-bump follow-up `5674a8b`: `manifest.json` and
  `meridian-extension/manifest.json` now declare `1.2.0`. Relative to the prior
  validated candidate `970421f`, those two version strings are the complete
  runtime/package diff.

## Candidate identity

- Manifest version: **1.2.0** (`manifest_version` 3)
- Validated worktree base commit:
  `5674a8bcd4d457ee97ebf479264e9695809ae114`
- Candidate content commit:
  `5674a8bcd4d457ee97ebf479264e9695809ae114`
- Tracked candidate directory: `meridian-extension`
- Candidate file count: **53**
- Candidate directory tree SHA-256:
  `e25a3c668b4124c3823d2cbb5694bd7afc928bd610949aa9da91ab5ff5d26c9e`
- Validation archive:
  `Meridian-1.2.0-069a7ea52b1640d69da3843ce1ffbc0e.zip`
- Validation archive size: **5,569,295 bytes**
- Validation archive SHA-256:
  `f7c0b4be744550c6dfec12c1c17babfef613b022b5759521cf8a58f126ce788e`
- Extracted archive tree SHA-256:
  `e25a3c668b4124c3823d2cbb5694bd7afc928bd610949aa9da91ab5ff5d26c9e`
- Per-file archive parity: **53 files matched, 0 mismatches**.

The prior full validation covered `970421f`. The scoped diff from that commit to
`5674a8b` contains only `"version": "1.1.0"` changing to
`"version": "1.2.0"` in the source and packaged manifests; within
`meridian-extension`, `manifest.json` is the only changed file. At this follow-up's
completion, only this regenerated record is modified in the worktree, so the
shipped candidate directory is exactly the committed tree identified above.

The directory hash is SHA-256 over every candidate file in case-sensitive
relative-path order. For each entry, the hasher receives the UTF-8 relative path,
a NUL byte, the raw file bytes, and a trailing NUL byte. This content hash is the
authoritative package identity.

The ZIP hash is specific to the `Compress-Archive` output created during this
run; ZIP timestamps and layout may differ when repackaged. Verify any upload by
extracting it and matching the directory tree hash, not by expecting the ZIP hash
to remain stable.

### Candidate file list

```text
background.js
components/BookmarksButton.js
components/ContextMenu.js
components/NewTabCard.js
components/SearchBar.js
components/SearchPopup.js
components/SearchSelection.js
components/SettingsPanel.js
components/TabCard.js
components/WorkspaceLane.js
components/sidebar.css
components/sidebar.html
components/sidebar.js
img/Meridian.ai
img/Meridian.svg
img/aurora.webp
img/chrome.svg
img/coffee.svg
img/edge.svg
img/emberstone.png
img/emberstone.svg
img/favicon.svg
img/icon-source.svg
img/icon128.png
img/icon16.png
img/icon32.png
img/icon48.png
img/meridian-screen1.png
img/meridian-screen2.png
img/meridian-screen3.png
img/meridian-screen4.png
manifest.json
meridian.css
meridian.html
meridian.js
utils/browserSearch.js
utils/customBackground.js
utils/domainCluster.js
utils/favicon.js
utils/homepageUrl.js
utils/localSearch.js
utils/storageMutationQueue.js
utils/tabActivation.js
utils/tabNavigation.js
utils/thumbnailBlobStore.js
utils/thumbnailCache.js
utils/thumbnailImage.js
utils/toolbarIcon.js
utils/urlInput.js
utils/vendor/README.md
utils/vendor/tldts.LICENSE
utils/vendor/tldts.esm.min.js
utils/workspaceManager.js
```

## Validation environment

- Date: **August 6, 2026**
- OS: Windows 11 Pro, version `10.0.26200`, build `26200`
- Node.js: `v24.12.0`
- Git: `2.52.0.windows.1`
- Headed browser: Google Chrome **`151.0.7922.76`** (stable)
- Loaded extension id: `gcdgpadcfhialnalbmiglhckgofnlhld`
  (derived from the unpacked-directory path; not the Web Store id)

Chrome was launched with a fresh temporary profile and
`--enable-unsafe-extension-debugging`. The committed candidate directory was
loaded with the DevTools `Extensions.loadUnpacked` command, and browser behavior
was driven over the DevTools Protocol. The browser harness and profile lived
outside the release package and were removed from the repository after the run.

## Automated release checks

Commands were run from the repository root:

```powershell
node --test tests/*.test.mjs

$files = @(git ls-files '*.js')
foreach ($file in $files) { node --check -- $file }

node -e "for (const file of ['manifest.json','meridian-extension/manifest.json']) { JSON.parse(require('node:fs').readFileSync(file,'utf8')); }"

node --test tests/packagedParity.test.mjs
git diff --check
git status --short
```

Results:

- Prior isolated correction check: **5 passed, 0 failed**.
- Full Node suite: **131 passed, 0 failed, 0 skipped**.
- Runtime JavaScript syntax: **56 files checked, 0 failures**.
- Manifest parsing: **2 parsed**, both version `1.2.0` and
  `manifest_version` 3.
- Runtime source/package parity: **35 file pairs matched, 0 mismatches**.
- Archive extraction parity: **53 files matched, 0 mismatches**.
- `git diff --check`: clean.
- `git status --short`: only `docs/release-validation.md` is modified by this
  follow-up; no candidate file is modified.

Node emitted `MODULE_TYPELESS_PACKAGE_JSON` performance warnings while importing
ES modules from this package-less test repository. These warnings were already
present, do not indicate parse or runtime failures, and did not change any test
result.

## Validation method and coverage

| Matrix area | Evidence this run |
| --- | --- |
| Extension load and New Tab override | Headed Chrome |
| Scoped/omni search and result grouping | Headed Chrome + regression suite |
| Keyboard navigation and accessibility state | Headed Chrome + regression suite |
| Escape clears query and collapses results | Headed Chrome + regression suite |
| Settings panel and pending-search ownership race | Headed Chrome + regression suite |
| Emberstone Studio footer | Headed Chrome + regression suite |
| History quick-open | Headed Chrome production component + regression suite |
| Popup height/scroll behavior | Headed Chrome |
| Aurora default and photo controls | Headed Chrome |
| Privacy-policy link | Headed Chrome + regression suite |
| Side-panel page and scope-chip visibility | Headed Chrome + regression suite |
| Service worker and thumbnail refresh message | Headed Chrome + regression suite |
| Console, exception, log, and network surfaces | Headed Chrome |
| Optional permission grant/deny/revoke dialogs | Regression suite |
| Native Chrome grouping and physical drag-and-drop | Regression suite |
| Thumbnail wrong-tab race and cache recovery | Regression suite |
| Cross-restart persistence | Regression suite; in-session storage was headed |

Native optional-permission dialogs, physical drag-and-drop into native Chrome tab
groups, and a full browser restart were not automated in this run. Their logic is
covered by the passing deterministic tests listed below. On the fresh profile,
Bookmarks and History correctly started disabled and both scope chips were hidden.

## Headed Chrome results

### Extension, New Tab, and service worker

- `chrome://newtab/` resolved to the loaded candidate's
  `chrome-extension://…/meridian.html` and rendered the Meridian search bar.
- In the prior full headed pass, the runtime manifest reported version `1.1.0`,
  `manifest_version` 3. The version-only follow-up now parses as `1.2.0`.
- `background.js` was present as a live service worker.
- `chrome.runtime.sendMessage({type: "REFRESH_THUMBNAILS"})` returned
  `{done: true}`.

### Default background and photo controls

- A fresh profile had no stored `background` or `photoAdjust` values.
- The rendered root style used `url("img/aurora.webp")`, opacity `1`, and blur
  `0px`, confirming the bundled Aurora image is the default.
- Settings rendered **Transparency** (`0`–`100`) and **Blur** (`0`–`20`) sliders.
- Driving the sliders to `25%` and `6px` immediately changed the rendered CSS to
  opacity `0.75` and blur `6px`, then persisted
  `{transparency: 25, blur: 6, fade: "bw"}` to sync storage.

### Footer, privacy link, and popup sizing

- The Emberstone Studio footer appeared directly above **Privacy & Data** with
  the packaged `img/emberstone.svg` mark.
- Its links resolved to `https://emberstone-studio.com/` and
  `https://ko-fi.com/emberstonestudio`, each with `target="_blank"` and
  `rel="noopener noreferrer"`.
- The privacy link resolved to and opened a new target at exactly
  `https://emberstone-studio.com/docs/privacy/meridian`.
- In the 850 CSS-pixel viewport, the shared popup's computed cap was `730.4px`
  (`100vh - 120px`) and its client height was `730px`; the settings content
  scrolled inside that cap. This confirms the intended
  `min(850px, calc(100vh - 120px))` behavior.

### History quick-open

The fresh profile intentionally lacked optional History permission, so the
in-product History chip was hidden. To exercise the new production component
without granting a browser-level permission outside the test profile, the loaded
extension page instantiated its packaged `createScopePopup` module with an
enabled History provider. The rendered **Open history page** button dispatched
`chrome://history/`, the list retained `role="listbox"`, and one supplied recent
history row rendered. Permission acquisition and revoked/denied states are covered
by `localSearchPermissions.test.mjs`, `manifestPermissions.test.mjs`, and
`bookmarksButton.test.mjs`.

### Search, keyboard, Settings race, and side panel

- Searching for `meridian` produced two labeled result groups.
- `ArrowDown` set one selected option and synchronized
  `aria-activedescendant`; `Escape` cleared the field, collapsed the popup, and
  removed the active descendant.
- Opening Settings immediately after starting another query left Settings open
  and did not allow the result popup to reclaim the shared shell.
- The side-panel page rendered two live tab rows in the fresh profile. Its
  Bookmarks and History scope chips were hidden because the optional sources were
  not enabled.

### Console and network surfaces

- Meridian page runtime exceptions: **0**.
- Meridian page console errors: **0**.
- Meridian page log errors: **0**.
- Side-panel runtime exceptions, console errors, and log errors: **0**.
- Expected requests observed while Settings was open were the packaged extension
  origin, stock-photo thumbnails from `picsum.photos`/`fastly.picsum.photos`, and
  search-provider icon origins for Google, Bing, DuckDuckGo, and Brave. No
  unexpected origin was observed.

## Regression-suite coverage for non-headed areas

- Optional permissions and scoped local search:
  `localSearchPermissions.test.mjs`, `manifestPermissions.test.mjs`,
  `bookmarksButton.test.mjs`, `browserSearchScopes.test.mjs`.
- Search selection, popup ownership, and scope transitions:
  `searchSelection.test.mjs`, `settingsPopupRace.test.mjs`,
  `interactionDefects.test.mjs`, `asyncLatestWins.test.mjs`.
- Grouping and drag-and-drop: `dragAndDrop.test.mjs`, `domainCluster.test.mjs`,
  `laneRenameAndContextMenu.test.mjs`.
- Thumbnail capture race, cache, storage, and errors:
  `thumbnailCaptureRace.test.mjs`, `thumbnailCache.test.mjs`,
  `thumbnailBlobStore.test.mjs`, `thumbnailImage.test.mjs`,
  `tabCardThumbnailError.test.mjs`.
- Lifecycle, refresh, navigation, and persistence:
  `backgroundLifecycle.test.mjs`, `backgroundRefresh.test.mjs`,
  `storageMutationQueue.test.mjs`, `tabActivation.test.mjs`,
  `tabNavigation.test.mjs`.

## Manifest version decision

Both `manifest.json` and `meridian-extension/manifest.json` now declare
**`1.2.0`**, applying the prior validation's recommendation for the additive
user-facing changes in this release. The version fields are the only changes from
the prior fully validated candidate. Manifest parsing, the full regression suite,
JavaScript syntax checking, source/package parity, the candidate tree hash, and
archive extraction parity were rerun against `1.2.0`; all are green. A headed
Chrome pass was not repeated because this follow-up contains no functional code
change.

## Publisher-side limitations

Repository and browser checks cannot:

- verify Chrome Web Store dashboard disclosures, certifications, permission
  justifications, or processing;
- prove which manifest version has already been accepted by the Store;
- replace periodic policy/license review for search-provider icons, Picsum,
  favicon handling, or vendored `tldts` content.

Before upload, confirm the public privacy page is deployed at the exact linked
URL and re-extract the final archive to match candidate tree SHA-256
`e25a3c668b4124c3823d2cbb5694bd7afc928bd610949aa9da91ab5ff5d26c9e`.
