# Release validation

## Decision

**Pass — Meridian 1.1.0 is ready to use as the release candidate.**

The automated release checks and the full headed-Chrome matrix passed against
the extracted contents of the exact ZIP identified below. The two popup/ARIA
blockers in the previous record no longer reproduce, and the thumbnail capture
race discards a pending capture when Meridian regains focus.

Chrome Web Store owner work remains outside this validation: publish the
privacy-policy URL, reconcile the dashboard disclosures and permission
justifications with `PRIVACY.md` and `STORE_LISTING.md`, and upload the ZIP with
the recorded SHA-256.

## Candidate identity

- Manifest version: **1.1.0**
- Candidate source commit:
  `bc08589f9ec0a88450c27cd842b1662b7c1409bc`
- Tracked candidate directory: `meridian-extension`
- Candidate file count: **47**
- Upload archive:
  `C:\Users\russp\AppData\Local\Temp\meridian-release-1.1.0-bc08589-b5ac51db\Meridian-1.1.0.zip`
- Archive size: **5,333,314 bytes**
- Archive SHA-256:
  `d6e92c4940900390cfb37130b567a84c38c2fe249156165a63682e82dc0277c7`
- Candidate directory tree SHA-256:
  `c981864c38d24466312a09a3b61c757fe1e81f1d583f51f3c01558896084a51b`
- Extracted archive tree SHA-256:
  `c981864c38d24466312a09a3b61c757fe1e81f1d583f51f3c01558896084a51b`
- Extracted browser-test directory:
  `C:\Users\russp\AppData\Local\Temp\meridian-release-1.1.0-bc08589-b5ac51db\extracted`

The directory hash is SHA-256 over each file in case-sensitive relative-path
order, appending UTF-8 relative path, NUL, raw file bytes, and NUL for every
entry. Per-file SHA-256 comparison also reported **0 differences** between the
tracked directory and extracted ZIP.

`RELEASE_VALIDATION.md` is not shipped in `meridian-extension`, so this record
does not alter the candidate or either candidate hash.

## Validation environment

- Date: **July 26, 2026**
- OS: Windows 11 Pro, version `10.0.26200`, build `26200`
- Node.js: `24.12.0`
- Git: `2.52.0.windows.1`
- Final headed browser: Google Chrome `150.0.7871.187`
- Supplemental browser-focus check: Chrome for Testing `151.0.7922.47`
- Extension id: `dihfoidpmcdoiciogpblkcnjflmalnbb`
- Fresh headed profile:
  `C:\Users\russp\AppData\Local\Temp\meridian-final-headed-stable-b5ac51db-11`

Chrome 150 was launched headed with a separate profile and remote debugging.
Because official Chrome ignores command-line unpacked-extension loading, the
candidate was loaded from the extracted directory with the DevTools
`Extensions.loadUnpacked` command under
`--enable-unsafe-extension-debugging`. No source or packaged file was changed
for this.

## Automated release checks

Commands run from the repository root:

```powershell
node --test tests/*.test.mjs

$jsFiles = @(git ls-files '*.js')
foreach ($file in $jsFiles) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $file" }
}

node -e "for (const file of ['manifest.json', 'meridian-extension/manifest.json']) { JSON.parse(require('node:fs').readFileSync(file, 'utf8')); console.log('Parsed ' + file); }"

node --test tests/packagedParity.test.mjs
git diff --check
git status --short
```

Results:

- Full suite: **112 passed, 0 failed, 0 skipped**.
- Runtime JavaScript syntax: **52 passed, 0 failed**.
- Manifest parsing: **2 passed, 0 failed**.
- Runtime source/package parity: **33 file pairs matched, 0 mismatches**.
- Archive extraction parity: **47 files matched, 0 mismatches**.
- `git diff --check`: passed.
- The worktree was clean before this record and the temporary validation
  harness were created.

## Headed Chrome matrix

The browser matrix used a local HTTP fixture with twelve differently colored,
metadata-bearing pages named `Smoke Local Result 01` through `12`. DevTools
Protocol monitored the extension page, actual side panel, and service worker
for runtime exceptions, console errors, log errors, warnings, network
requests, DOM state, Chrome tab/group state, storage, and accessibility-tree
state. Windows UI Automation invoked the native permission-prompt buttons.

### New-tab behavior and navigation

- `meridian-view` kept a newly opened, unpinned Meridian New Tab.
- `focus-pinned` closed the disposable New Tab, preserved the tab count, and
  activated the existing pinned Meridian tab.
- `open-homepage` navigated the New Tab to the normalized configured local
  HTTP URL.
- A direct `127.0.0.1:8137/direct` value rendered **Go to** / **Open URL**.
  Launching it from the pinned Meridian tab opened a separate unpinned tab and
  preserved the dashboard.
- DuckDuckGo selection persisted and the Web row opened
  `https://duckduckgo.com/?q=provider+smoke&ia=web`.

A real headed `Ctrl+T` check produced both permitted Chrome outcomes across
fresh Chrome for Testing profiles:

- One run focused the native **Address and search bar**
  (`OmniboxViewViews`, automation id `view_1012`).
- Another run focused Meridian's **Search anything** combobox and typed the
  probe into the page input.

Chrome owns the initial New Tab focus decision; Meridian's three configured
navigation behaviors were deterministic in the final matrix.

### Search, keyboard, and accessibility

- With optional sources enabled, `Smoke Local Result` rendered ten Open Tabs,
  ten History results, and one Web action.
- The shared popup stayed anchored below the search pill and was vertically
  scrollable.
- Result sections exposed labeled `role="group"` semantics and every action
  exposed `role="option"`.
- The input exposed `role="combobox"`, the correct `aria-controls`, and
  `aria-expanded="true"` while results were visible.
- Arrow Down synchronized the highlighted row, `aria-selected`, and
  `aria-activedescendant`.
- Pointer hover moved the single visual/ARIA selection; Enter activated that
  exact live tab.
- Escape cleared the query, removed focus, closed results, set
  `aria-expanded="false"`, and removed `aria-activedescendant`.
- The Chrome accessibility tree contained the combobox, listbox, live status,
  and all visible options.

### Former popup blockers

Both prior release blockers passed in the real browser:

1. Starting with `scope retained query` in History and clicking Settings left
   Settings open after 900 ms, kept the query, reset the scope to All, and left
   both results popups closed. Pending search results did not reclaim the
   shared popup.
2. Bookmarks → History and History → Bookmarks each completed with the scoped
   listbox visible, `aria-expanded="true"`, the correct controls id, and
   synchronized active-descendant state after keyboard selection.

### Optional permissions and settings

- A fresh profile began with Bookmarks and History absent and disabled.
- The native History prompt was denied through its **Deny** button; the grant,
  preference, and checkbox remained false.
- A second native History prompt was accepted through **Allow**; the grant and
  preference became true.
- The native Bookmarks prompt was accepted through **Allow**; the grant and
  preference became true.
- A known bookmark and history URL were returned in their scoped searches.
- Bookmarks and History were then revoked separately. Each permission became
  absent and each saved source became false before the next revocation.
- Settings displayed Privacy & Data, Appearance, Search, and Tabs in order.
- The privacy disclosure covered automatic capture/indexing, local storage,
  optional Bookmarks/History access, and a keyboard-focusable policy link.
- Dark theme, DuckDuckGo, group-by-domain, and New Tab behavior persisted.
- Both settings card grids exposed radiogroup/radio semantics with one checked
  and tabbable option per group.

### Grouping and drag-and-drop

- A native group named `Final Smoke Native Group` rendered with its two real
  tab cards.
- Drag-and-drop moved an ungrouped third card into that native Chrome group;
  Chrome reported the expected group id afterward.
- Group-by-domain was enabled through Settings and remained enabled after
  reload/restart.

### Thumbnails and race regression

- Activating a page and returning to Meridian after 80 ms left no thumbnail
  under the abandoned page id after the delayed capture window. This directly
  verifies the formerly reported wrong-tab capture race.
- The explicit full refresh returned `{"done":true}`, captured all **12**
  eligible HTTP tabs, stored **12** `thumb_*` values, and restored the pinned
  Meridian tab as active.
- The stored thumbnail count remained **12** after clean browser shutdown and
  extension reload from the same extracted directory.

### Side panel and persistence

- The actual Chrome side panel opened through `chrome.sidePanel.open`.
- It displayed the native group and keyboard-accessible tab rows
  (`role="button"`, `tabindex="0"`).
- Searching `Smoke Local Result 03` returned the open-tab result and the
  matching History result, both keyboard accessible.
- After clean shutdown and reload, extension version 1.1.0 retained dark
  theme, DuckDuckGo, group-by-domain, `focus-pinned`, both revoked-source
  preferences, the pinned Meridian tab, and all 12 thumbnails.
- Chrome 150's default startup policy did not restore the fixture tabs or
  their native group. That browser-owned session policy is not treated as
  extension persistence.

### Network and console inspection

Observed extension-page HTTP(S) origins were:

- `https://www.google.com`
- `https://duckduckgo.com`
- `https://www.bing.com`
- `https://brave.com`
- `https://picsum.photos`
- `https://fastly.picsum.photos` (Picsum CDN redirect)
- the local `http://127.0.0.1:8137` validation fixture

These match the provider icons, selected provider navigation, disclosed
Picsum photo backgrounds/CDN, and the local fixture. No unexpected origin was
observed.

There were **0** runtime exceptions, console errors, log errors, or unhandled
rejections in the extension page, actual side panel, or service worker during
the final headed matrix.

Handled warnings were limited to automatic capture attempts against transient
or browser-controlled pages during rapid New Tab/navigation changes. The race
discard remained correct, and the explicit refresh captured every eligible
HTTP tab.

## Publisher-side limitations

Repository and browser checks cannot:

- publish or verify the production privacy-policy URL;
- verify Chrome Web Store dashboard disclosures, certifications, or
  permission justifications;
- guarantee Chrome Web Store processing of the archive;
- replace periodic review of search-provider, Picsum, favicon, and vendored
  `tldts` policy/license requirements.

Use the archive SHA-256 above to confirm the dashboard upload is the validated
artifact.
