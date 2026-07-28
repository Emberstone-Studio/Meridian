# Static review: root Meridian source

No critical code-execution defect was found. One high-severity Chrome Web Store/privacy blocker, six medium defects/risks, and three low defects were confirmed. Review was source-only: no application code or tests were executed, `meridian-extension/` was not inspected, and no files were changed.

## High

### 1. Sidebar search transmits browsing domains to Google, with no reviewed privacy/disclosure surface

**Locations:** `components/sidebar.js:64-67`, `components/sidebar.js:73-77`, `components/sidebar.js:324-329`; compare `components/BookmarksButton.js:26-30`. Manifest access is at `manifest.json:13-14`; the reviewed README has no privacy policy or Limited Use disclosure.

`faviconUrl()` embeds each page hostname in `https://www.google.com/s2/favicons?...`. Tab rows use it when Chrome has no favicon, and every sidebar search result calls `makeFaviconImg(item.url, null)`, so domains from tabs, bookmarks, and history can be sent to Google. Chrome classifies domains/URLs as browsing activity and requires a privacy policy even when user data stays local; this actual third-party transfer is more serious. This is likely to block or endanger Web Store review. See the official [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).

**Fix:** use the packaged `/_favicon/` endpoint already implemented in `BookmarksButton.js` and an in-package fallback. Publish a privacy policy and keep Web Store privacy fields/Limited Use certification consistent with tab, bookmark, history, screenshot, sync-storage, and network behavior. If any browsing-data transfer remains, add required prominent disclosure and consent before it occurs.

## Medium

### 2. Inline lane rename loses Enter/Escape after the first typed key

**Location:** `components/WorkspaceLane.js:409-437`.

The rename `keydown` listener uses `{ once: true }`. The first ordinary character removes it, so Enter no longer commits via blur and Escape no longer restores the original title after typing.

**Fix:** keep the listener for the editing session and explicitly remove it from one cleanup path after Enter, Escape, or blur.

### 3. Sidebar search allows stale async results to overwrite the current query or cleared list

**Locations:** `components/sidebar.js:367-401`, `components/sidebar.js:437-446`, `components/sidebar.js:461-467`.

Input events await `runSearch()` without a sequence/current-query check. A slower old query can render after a newer one; clearing renders the tab list, but a pending search can later replace it with stale results.

**Fix:** increment a generation on every input change, including clear, and check generation plus current query before each DOM write. `meridian.js:639-658` already demonstrates the required guard.

### 4. Auto-accent analysis can apply a stale background

**Locations:** `components/SettingsPanel.js:459-465`, `components/SettingsPanel.js:757-815`, `components/SettingsPanel.js:979-985`.

Photo/custom analysis waits for image load and canvas sampling, but `applyAccentFromBackground()` has no generation check. A slow old photo can finish after a newer selection and overwrite `lastDominant`, `lastBgLum`, and the current CSS variables.

**Fix:** add an analysis generation token (or abortable pipeline) and cache/apply only the latest result, including storage-triggered updates.

### 5. “Move to new group” leaves a stale Meridian assignment

**Locations:** `components/ContextMenu.js:67-88`; compare `components/ContextMenu.js:102-112`.

The native new-group branch never calls `unassignTab(tab.id)`, while the existing-group path does. The hidden assignment returns if the tab is later ungrouped, unexpectedly sending it back to its old Meridian workspace.

**Fix:** after successful native grouping, `await unassignTab(tab.id)` before dispatching the rename event.

### 6. Disabled local-search sources are queried before being filtered out

**Locations:** `meridian.js:647-654`, `components/sidebar.js:367-374`, settings at `components/SettingsPanel.js:270-312`.

Both callers invoke aggregate `search()` before loading `localSearch`; disabled tab/bookmark/history results are discarded only afterward. The toggles reduce display but do not prevent backend access/work, contrary to data minimization and likely user expectation.

**Fix:** read enabled sources first and pass them to the backend, or invoke only enabled source searches. If bookmarks/history become optional permissions, request them only when their source or explicit scope is enabled.

### 7. Install-time permissions are broader than the reviewed source can justify

**Location:** `manifest.json:13-14`; thumbnail refresh is at `components/SettingsPanel.js:624-645` and `README.md:51-52`.

The manifest requires `scripting` and `<all_urls>` at install and has no optional permissions. No in-scope file invokes `chrome.scripting`; `<all_urls>` may support the excluded background worker’s all-tab screenshots, but that cannot be verified within the assigned scope. Web Store policy requires the narrowest permissions and recommends optional grants where possible. See [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) and [minimum permission](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#minimum_permission).

**Fix:** verify the excluded worker before release; remove `scripting` if unused. Prefer optional `<all_urls>` requested from thumbnail enable/refresh and consider optional bookmarks/history tied to their controls. If persistent all-site access is essential, document the exact user-facing justification in the listing and privacy material.

## Low

### 8. Enter-to-web-search leaves stale results behind a cleared field

**Locations:** `components/SearchBar.js:125-135`, `meridian.js:627-633`.

`doSearch()` clears input UI but does not notify the query handler, so the popup retains the old query. The web-search row correctly calls `clearSearch()`. Returning after an Enter-launched search can show stale results under an empty field.

**Fix:** use the public `clearSearch()` path or call `notifyQuery()` after clearing.

### 9. Homepage settings save and navigate unvalidated URLs

**Locations:** `components/SettingsPanel.js:217-227`, `meridian.js:149-170`.

The URL input is saved without `checkValidity()` or scheme validation and passed verbatim to `chrome.tabs.update`. Invalid, relative, or unsupported-scheme values can fail or resolve unexpectedly.

**Fix:** parse with `new URL`, allow supported `http:`/`https:` schemes, normalize before saving, show validation feedback, and catch navigation failures.

### 10. Sidebar ArrowDown targets non-focusable rows

**Locations:** `components/sidebar.js:179-209`, `components/sidebar.js:324-358`, `components/sidebar.js:456-459`.

Both builders create plain `div.tab-row` elements without `tabIndex`; result rows have no Enter/Space handler. `.focus()` therefore does not provide the intended keyboard transition.

**Fix:** use semantic buttons/links or add `tabIndex`, role/label semantics, and Enter/Space activation.

## Dead code / maintainability nits

Confirmed refactor leftovers, not product defects:

- `meridian.js:29,195-198`: `bookmarksApi` is never assigned.
- `meridian.js:175,469,656`: `browserSearchResults` is never read.
- `meridian.js:449-465,645`: `filterGrid()` is only called with `""`; its non-empty branch is unreachable.
- `meridian.js:704-708`: `.search-web-fallback` styles have no element.
- `components/SearchBar.js:29-35,67`: bookmark/history glyph constants are unreachable; only `SCOPE_GLYPHS.all` is used.
- `components/SearchPopup.js:34-39`: `setContent` and `setLabel` have no in-scope caller.
- `components/SettingsPanel.js:121`: `onClose` is unused.
- `meridian.css:219-245,283-304,652-675,813-857,928-958`: obsolete old engine/scope/bookmark/new-group/select selectors have no matching markup.
- `components/sidebar.css:334-351`: `.sidebar-title` and `#sidebar-header` do not exist in sidebar HTML/JS.

**Fix:** remove these stale symbols/selectors; simplify `filterGrid` to its actual reset behavior or restore a real non-empty caller.

## Chrome Web Store checks that passed in scope

- Manifest V3 is declared; the module service worker, side-panel files, and icons exist.
- Both HTML entry points use packaged external module scripts; there are no inline handlers.
- No `eval`, `new Function`, remote JavaScript imports, or obfuscation was found. Remote resources are images, not executable code.
- In-scope tabs, tab-groups, storage, bookmarks, history, side-panel, and packaged-favicon APIs have corresponding declarations; `chrome.action.setIcon` needs no separate permission.
- Static SVG passed to `innerHTML` is hard-coded package content, not user-controlled markup.

## Validation

Static inspection only. No source, extension page, service worker, or test suite was executed or loaded. `meridian-extension/`, `background.js`, and `utils/*` bodies were not reviewed. The worktree remains clean.