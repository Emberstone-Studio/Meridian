# Release validation

## Decision

Validated on July 26, 2026 on Windows with:

- Node.js `24.12.0`
- Chrome for Testing `151.0.7922.47` (`Chrome/151.0.7922.47`,
  DevTools Protocol `1.3`)
- unpacked extension id `innmjmjkjlcmomepgeolihiohldkikod`

The automated suite and the main Chrome smoke matrix pass. Release remains
blocked by two reproducible popup/ARIA defects listed under
[Remaining blockers](#remaining-blockers). No JavaScript exception, console
error, or unhandled rejection was observed in the extension page, actual side
panel, or service worker.

## Automated validation

Commands run from the repository root:

```powershell
node --test tests/*.test.mjs

$jsFiles = @(rg --files -g '*.js' -g '!node_modules')
foreach ($file in $jsFiles) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $file" }
}

# Independent source/package SHA-256 comparison:
# background.js, manifest.json, meridian.css, meridian.html, meridian.js,
# and every file under components/ and utils/.

git diff --check
git status --short
```

Results:

- Full suite: **74 passed, 0 failed**.
- Syntax: **48** runtime JavaScript files parsed successfully.
- Source/package parity: **31** root/component/utility file pairs matched,
  with **0** mismatches. `tests/packagedParity.test.mjs` also passed.
- Baseline `git diff --check`: passed; the worktree was clean before this
  release record was edited.

## Chrome procedure

The release copy was loaded from:

```text
C:\Users\russp\AppData\Local\Temp\tasker-task-worktrees\2b13ff41ffe7\run-real-chrome-smoke-test-for-search-and-new-ta-aabc5a628c9d29c9\meridian-extension
```

The main matrix used a newly created profile. The equivalent launch command
was:

```powershell
$chromePath = 'C:\Users\russp\AppData\Local\Temp\chrome-for-testing-151.0.7922.47\chrome-win64\chrome.exe'
$profilePath = 'C:\Users\russp\AppData\Local\Temp\meridian-569e-clean-10'
$extensionPath = (Resolve-Path 'meridian-extension').Path

Start-Process -FilePath $chromePath -WindowStyle Hidden -ArgumentList @(
  '--headless=new'
  '--remote-debugging-port=9541'
  '--no-first-run'
  '--no-default-browser-check'
  '--disable-component-update'
  '--disable-sync'
  "--user-data-dir=$profilePath"
  "--disable-extensions-except=$extensionPath"
  "--load-extension=$extensionPath"
  'about:blank'
)
```

A temporary Node.js DevTools Protocol harness (native `fetch` and
`WebSocket`) reloaded and exercised the extension page, drove trusted mouse
input where a user gesture was required, opened the real side panel, inspected
DOM/ARIA/storage/tab state, and subscribed to `Runtime.exceptionThrown`,
`Runtime.consoleAPICalled`, and `Log.entryAdded` on the extension page, side
panel, and service worker. The harness was removed after the run.

For the browser-chrome focus and optional-permission prompts, a second new,
headed profile was launched:

```powershell
$profilePath = 'C:\Users\russp\AppData\Local\Temp\meridian-569e-headed-01'

Start-Process -FilePath $chromePath -WindowStyle Normal -ArgumentList @(
  '--remote-debugging-port=9542'
  '--no-first-run'
  '--no-default-browser-check'
  '--disable-component-update'
  '--disable-sync'
  '--window-position=20,20'
  '--window-size=1200,850'
  "--user-data-dir=$profilePath"
  "--disable-extensions-except=$extensionPath"
  "--load-extension=$extensionPath"
  'about:blank'
)
```

Windows UI Automation identified the actual focused browser control and
invoked the native **Allow** and **Deny** permission-prompt buttons. DevTools
Protocol inspected the Meridian document at the same time.

After the main run, Chrome was closed through `Browser.close` and relaunched
with the same `meridian-569e-clean-10` profile to check restart persistence.

## New Tab focus and navigation

### Headed New Tab / omnibox result

A real `Ctrl+T` New Tab session produced this exact result:

- Windows UI Automation reported focus on **Address and search bar**,
  `ControlType.Edit`, class `OmniboxViewViews`, automation id `view_1012`, in
  the headed Chrome for Testing process.
- Inside the override document, `location.href` was the packaged
  `meridian.html`; the `.search-input` had `autofocus`, and
  `document.activeElement` reported that input.
- Typing `meridian-focus-probe-569e` put that text in the omnibox
  `ValuePattern`; the Meridian page input remained empty.

Therefore Meridian does attempt page focus, and the document can report the
input as active, but it **does not override Chrome's omnibox focus in a real
headed New Tab session**. The browser-chrome focus result, not
`document.activeElement`, determines where the user's typing goes.

Headless New Tab observations were inconsistent (one fresh instance reported
the page input focused; another reported `BODY`). They are retained only as a
limitation and were not used to claim omnibox behavior.

### Behavior and navigation

- `focus-pinned`: opening a New Tab kept the tab count at 19, activated the
  existing pinned Meridian tab, and closed the disposable New Tab instance.
- Pinned Meridian direct URL: `localhost:8080/path` was recognized as
  **Open URL** and opened unpinned as `http://localhost:8080/path`; the pinned
  Meridian tab remained intact.
- Unpinned Meridian direct URL: `example.org/smoke` replaced that unpinned
  Meridian tab in place with `https://example.org/smoke`.
- Web search: after choosing DuckDuckGo, `provider smoke` opened
  `https://duckduckgo.com/?q=provider%20smoke` from the pinned dashboard.
- Returning to pinned Meridian after activating a highlighted local result
  preserved `Smoke Local Result` in the input.
- Switching between Bookmarks and History preserved the current query.

## Search, keyboard, and accessibility matrix

Fourteen indexed smoke tabs were created; the first two were put in a native
Chrome group named `Smoke Native Group`.

For `Smoke Local Result`, the popup rendered 10 **Open Tabs** rows plus one
**Web** row:

- Popup geometry was left `81`, top `84`, width `600`; the search anchor ended
  at y=`76`.
- The popup had `clientHeight=251`, `scrollHeight=534`, and
  `overflow-y:auto`, confirming anchored placement and scrolling.
- All 11 actionable rows had `role="option"` and the containing sections had
  labeled `role="group"` semantics.
- The combobox reported `role="combobox"`, `aria-expanded="true"`,
  `aria-controls="browser-search-results"`, and announced
  **11 results available.**
- Arrow Down selected `Smoke Local Result 01`, synchronized
  `aria-activedescendant`, `aria-selected="true"`, and the highlighted class.
- Pointer hover on the next row moved the single visual/ARIA selection to
  `Smoke Local Result 02`. Enter activated that exact tab.
- Escape cleared the query, removed focus, closed the popup, changed
  `aria-expanded` to `false`, and removed `aria-activedescendant`.
- A query with no local result rendered only the Web section and no obsolete
  local-empty message.
- `localhost:8080/path` rendered **Go to localhost:8080/path** / **Open URL**
  instead of a Web-search action.

The `role="status"`/`aria-live="polite"` region produced these observed
announcements:

- `11 results available.`
- `Bookmark access is off. Enable it in Settings to search this source.`
- `History access is off. Enable it in Settings to search this source.`
- `1 bookmark result available.`
- `1 history result available.`

## Permissions, scopes, and settings

- A fresh profile began with both optional permissions absent and both sources
  disabled.
- With access off, Bookmark and History scope popups opened with the retained
  query and the explicit access-off messages above; no protected API result was
  shown.
- The headed History permission prompt displayed
  **Read and change your browsing history on all your signed-in devices**.
  Invoking **Deny** left the permission and saved preference false and the
  access-off UI visible.
- Invoking **Allow** enabled History. A synthetic history entry at
  `https://example.net/meridian-history-569e` was found in the History scope.
- A bookmark named `Meridian Smoke Bookmark 569e` was found in Bookmarks.
  Arrow selection set an option id, `aria-selected="true"`, and the matching
  active descendant.
- Revoking Bookmarks by itself removed the grant and changed the stored
  `localSearch.bookmarks` value to `false`; History revocation behaved the
  same. Effective search stayed off after revocation.
- Settings used the shared anchored popup and exposed Appearance, Search, and
  Tabs sections. New Tab behavior and provider choices had radiogroup/radio
  semantics with one checked/tabbable card.
- Dark theme, DuckDuckGo, group-by-domain, and New Tab behavior persisted
  through a full page reload.

One scoped ARIA transition and one Settings transition failed; see Remaining
blockers.

## Grouping, thumbnails, side panel, and persistence

- The native `Smoke Native Group` rendered as a Meridian lane with two tabs.
- Full thumbnail refresh returned `{"done":true}` and wrote 18 `thumb_*`
  entries.
- The actual side panel opened through `chrome.sidePanel.open`. It rendered 18
  rows; every row had `role="button"` and `tabindex="0"`. Searching
  `Smoke Local Result 03` returned that indexed tab with the same keyboard
  semantics.
- After a clean browser close and restart, the same profile restored:
  - Dark theme
  - DuckDuckGo
  - group-by-domain enabled
  - `meridian-view` New Tab behavior
  - 18 thumbnail entries
  - the pinned Meridian tab
  - the two-tab native group named `Smoke Native Group`
  - the smoke tabs and URLs

## Console inspection

There were **0** runtime exceptions, console errors, log errors, or unhandled
rejections in the extension page, actual side panel, and service worker.

The service worker emitted two handled warnings during the intentionally dense
navigation/refresh sequence:

1. `captureVisibleTab` could not access an empty transient URL while an
   unpinned Meridian tab was navigating.
2. One delayed automatic capture exceeded
   `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`.

The explicit full refresh still completed and stored all 18 eligible
thumbnails. These warnings are a release risk for capture completeness under
rapid activity, but they were handled and did not produce a rejected message
or console error.

## Remaining blockers

### 1. Settings is displaced by retained-query results after leaving a scope

**Severity: High**

Reproduction:

1. Enter `scope retained query`.
2. Open History or Bookmarks.
3. Click Settings.

Observed state after 750 ms:

```json
{
  "settingsOpen": false,
  "resultsOpen": true,
  "scope": "all",
  "query": "scope retained query"
}
```

`meridian.js:775` resets the scope before opening Settings. The retained query
starts `handleBrowserQuery` (`meridian.js:653`); when it resolves, the results
popup opens and the shared-popup registry closes Settings. Clear/invalidate
the pending browser search when Settings takes ownership (for example, call
`clearBrowserSearch()` after the scope reset and before `openSettings()`), then
add a regression test for this exact sequence.

### 2. `aria-expanded` becomes false while the scoped listbox remains open

**Severity: High (accessibility)**

After switching directly from one open scope to the other, both positive
Bookmark and History result views remained visible and navigable, but the
combobox reported `aria-expanded="false"`. Bookmark selection simultaneously
set `aria-activedescendant="bookmark-result-6"`, so assistive technology
received contradictory collapsed/active-option state.

`applyScope` unconditionally collapses the combobox at
`components/SearchBar.js:122`. The scope shell is already visible, so
`createSearchPopup.open()` returns early at `components/SearchPopup.js:32`
without notifying its open-change listeners to restore `aria-expanded`.
Re-notify listeners when `open()` is called on an already-open popup, or
explicitly resynchronize the combobox after the new scoped content is ready.
Add a real transition test for Bookmarks → History and History → Bookmarks.

## Publisher-side limitations

These repository checks do not replace Chrome Web Store publisher work:

- Publish a reachable privacy-policy URL matching `PRIVACY.md` and reconcile
  Store disclosures with tab metadata, optional bookmarks/history, captured
  screenshots, and synced preferences.
- Justify persistent `<all_urls>`, `scripting`, `unlimitedStorage`, thumbnail
  capture, automatic metadata indexing, and optional permissions.
- Review external search-provider icon and Picsum photo requests in the final
  upload archive.
- Retain the vendored `tldts` license and periodically refresh its Public
  Suffix List data.
