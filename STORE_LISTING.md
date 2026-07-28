# Meridian — Chrome Web Store submission copy

Last updated: July 26, 2026

Publisher-facing copy for the Chrome Web Store listing, the **Privacy
practices** tab, and the per-permission justification fields. It is derived from
the source in this repository (manifest, `background.js`, `utils/`, and
`components/`) and reconciled with `PRIVACY.md` and `README.md`.

> **Owner action required.** Everything here is draft copy for review. It is not
> a submission and does not certify anything in the Chrome Web Store dashboard.
> Paste each block into the matching dashboard field, confirm it against the
> exact archive you upload, and complete the owner-only follow-ups at the end of
> this document. Items marked **[OWNER-ONLY — NOT DONE]** were not and cannot be
> performed from the repository.

---

## 1. Store listing

### Name
Meridian

### Summary (short description, ≤132 characters)
Spatial tab command center — a visual new-tab page that turns your open tabs
into searchable thumbnail cards.

### Category (suggested)
Workflow & Planning (or Productivity)

### Detailed description
Meridian replaces your new-tab page with a spatial command center for your open
tabs.

Your tabs appear as live thumbnail cards, organized into workspace lanes that
map to Chrome tab groups or to custom groups you create in Meridian. Drag to
reorder tabs within and across groups, collapse lanes you are not using, and
hover a card to open a full-size preview with the tab's title and URL.

**Features**
- **Tab cards & workspace lanes** — every open tab as a live thumbnail, grouped
  into collapsible lanes with drag-and-drop reordering.
- **Local search** — instantly find open tabs by title, URL, domain, and page
  context. Bookmark and history search are optional and off until you turn them
  on.
- **Multi-engine web search** — search with Google, DuckDuckGo, Bing, or Brave
  from the top of every new-tab page; your choice is remembered.
- **Theming & backgrounds** — Light, Dark, or System theme; solid colors,
  gradient presets, curated Picsum photos, or your own uploaded image.
- **Tab organization** — optionally cluster ungrouped tabs by domain.
- **Flexible new-tab behavior** — open a fresh Meridian view, return to a pinned
  Meridian tab, or load a custom homepage.
- **Keyboard-first** — jump to Meridian, move between tabs and lanes, focus
  search, and create groups without the mouse.

**Privacy**
Meridian runs entirely in your browser. It has no accounts, no analytics, and no
Meridian-operated server. Your tab, page, screenshot, bookmark, and history data
stays in your Chrome profile. Full details are in the extension's privacy policy.

---

## 2. Privacy practices tab

### 2.1 Single purpose (single-purpose description field)
Meridian is a new-tab replacement that helps users view, search, and organize
their open browser tabs as a visual, spatial workspace. Every permission and
data access exists to render tabs as searchable thumbnail cards, to search local
browser data the user opts into, and to personalize the new-tab surface.

### 2.2 Data types collected or used
Declare the following categories in the dashboard. All are used **on-device for
the extension's features**; none are transferred to a Meridian-operated server.

| Dashboard data type | Applies? | What it covers in Meridian |
| --- | --- | --- |
| **Web browsing activity** | Yes | Open tab titles, URLs, domains, tab-group membership, window IDs, tab activation/previous-tab state, and — only if the user enables them — bookmark and browsing-history entries used for local search. |
| **Website content** | Yes | Per-tab meta-description and H1/H2 heading text read after a page finishes loading, and JPEG screenshots of the visible area of active tabs captured for thumbnails/previews. Screenshots can contain whatever is on screen at capture time. |
| **User activity** | Yes (recommended) | Tab activation, previous-tab tracking, grouping, ordering, and workspace assignments that drive the UI. Disclosed here because reviewers may treat this interaction/usage state as user-activity data. |
| Personally identifiable information | No | Not collected. |
| Health information | No | Not collected. |
| Financial and payment information | No | Not collected. |
| Authentication information | No | Not collected. |
| Personal communications | No | Not collected. |
| Location | No | Not collected. |

> The user's **uploaded custom background image** and **preferences** (theme,
> background choice, search provider, enabled local-search sources, new-tab
> behavior, optional homepage URL, domain-grouping) are user-provided content
> stored on the device. Preferences sync through the user's own Chrome Sync if
> enabled; the uploaded image bytes and captured screenshots are never placed in
> sync storage. Map these to the dashboard's user-content categories as the
> current form requires.

### 2.3 Data usage certifications
Based on the reviewed source, the publisher should be able to affirm all three
required certifications — **confirm each against the uploaded archive before
checking the box:**

- ☑ I do **not** sell or transfer user data to third parties outside of the
  approved use cases.
- ☑ I do **not** use or transfer user data for purposes unrelated to my item's
  single purpose.
- ☑ I do **not** use or transfer user data to determine creditworthiness or for
  lending purposes.

### 2.4 Privacy policy URL
Host the text of `PRIVACY.md` at a stable, publicly reachable HTTPS URL and enter
it here. **[OWNER-ONLY — NOT DONE]** — no public policy URL has been published or
verified from this repository.

---

## 3. Data handling disclosure (paste-ready listing block)

Meridian processes the following **locally in your browser** to provide its
features. Most of it stays in on-device storage; preferences are the exception
and can sync through your own Chrome Sync account (see "Local & sync storage"
below):

- **Browsing activity** — open tab titles, URLs, domains, tab-group membership,
  and tab activation/order, used to display, search, and manage your tabs. A
  local search index and workspace/UI state are stored in `chrome.storage.local`.
- **Website content** — after a page loads, Meridian reads its meta description
  and H1/H2 headings so local search can match page context beyond the title and
  URL. It does not read form input or other page-body text.
- **Screenshots** — Meridian captures the visible area of active tabs after tab
  activation or page load, and during a user-requested full refresh that cycles
  eligible tabs. Automatic captures (activation/page load) do not filter by URL
  in Meridian's code — Chrome's `captureVisibleTab` API itself refuses
  `chrome://`, Chrome Web Store, and other extensions' pages, so only those
  attempts fail; any other page, including one with sensitive content on
  screen, is captured. The full refresh additionally skips `chrome://`,
  `chrome-extension://`, and `about:` tabs in Meridian's own code before
  switching to them. Screenshots are stored as JPEG blobs in extension-local
  IndexedDB; cache metadata and refresh markers use `chrome.storage.local`.
  Storage targets roughly 200 entries / ~50 MB and
  prunes the oldest thumbnails first, but a still-open tab's thumbnail is never
  evicted to make room, so usage can exceed that target while those tabs stay
  open. A tab's thumbnail is removed when the tab closes.
- **Local & sync storage** — preferences (theme, background, search provider,
  enabled local-search sources, new-tab behavior, optional homepage, domain
  grouping) are stored in `chrome.storage.sync`. If the user has Chrome Sync
  turned on, Chrome syncs this data through the user's own Google/Chrome
  account to their other signed-in devices, subject to the user's Chrome Sync
  settings — it is not Meridian-operated syncing. Workspaces, search metadata,
  thumbnails, the Meridian/previous tab IDs, and an uploaded custom background
  image stay in `chrome.storage.local` / IndexedDB and are not synced.
- **Optional bookmarks & history** — off by default. Meridian requests bookmark
  or history access only when you enable that source in Settings → Local Search
  or select its search scope, and queries it only to show local-search results.
  It keeps no separate persistent copy; revoking access turns the source off.
- **External requests** — search-provider icons load from fixed Google,
  DuckDuckGo, Bing, and Brave icon URLs (these contain no visited URL); favicons
  resolve through Chrome's packaged `_favicon` provider (not Google S2); the
  background settings load photo previews and selected photos from
  `picsum.photos` by seed. Starting a web search, opening a result, or choosing a
  custom homepage navigates your browser to that destination normally.
- **Retention & deletion** — data persists in local/sync storage until replaced,
  evicted, cleared, or removed with the extension or profile. Closing a tab
  deletes its cached thumbnail and search entry (including extracted metadata).
  You can clear all extension data through Chrome's controls.
- **No telemetry or backend** — Meridian has no Meridian-operated server, no
  analytics or advertising SDK, no account system, and no telemetry uploader.

---

## 4. Permission justifications

Paste each string into the matching "why do you need this permission?" field.

### Required permissions

**`tabs`**
Read tab titles, URLs, domains, and group/window membership and act on tabs
(activate, close, move, group, restore) so Meridian can render the new-tab page's
tab cards, power local tab search, and manage tabs from its UI.

**`tabGroups`**
Read and manage Chrome tab groups so Meridian's workspace lanes reflect and can
modify tab-group membership and grouping.

**`storage`**
Persist the user's preferences, workspaces, tab-search index (including extracted
page metadata), thumbnail cache metadata, and tab-tracking state in
`chrome.storage.local`/`chrome.storage.sync`, plus JPEG thumbnail blobs in
IndexedDB, so settings and layout survive across sessions.

**`unlimitedStorage`**
Screenshot thumbnails are stored as JPEG blobs in IndexedDB and can exceed the
default storage quota. `unlimitedStorage` lets the local thumbnail cache hold enough
entries to be useful. Code targets roughly 200 entries / ~50 MB and prunes the
oldest thumbnails first when over that target, but never evicts a thumbnail for
a tab that is still open — so actual usage can exceed the target while those
tabs stay open.

**`favicon`**
Display site icons for tabs and search results by resolving page URLs through
Chrome's packaged `_favicon` provider, avoiding third-party favicon lookups.

**`sidePanel`**
Provide Meridian's side-panel UI, which opens when the toolbar icon is clicked.

**`scripting`**
After an open tab finishes loading, run a one-shot extractor that reads only that
page's meta description and H1/H2 heading text into the local tab-search index,
so local search can match page context beyond the title and URL. It does not read
form input or other page-body content. `scripting` (rather than click-scoped
`activeTab`) is required because this indexing happens automatically on page
load, not from a user click.

**`host_permissions: <all_urls>`**
Allow two automatic, non-click actions across the tabs the user already has open:
(1) capturing the visible tab via `captureVisibleTab` after tab activation, after
a page finishes loading, and during a user-requested full refresh, to build
thumbnail cards; and (2) running the load-time meta/H1/H2 metadata extractor
above. Chrome's click-scoped `activeTab` cannot authorize these automatic
background actions, so broad host access is required for the shipped
live-thumbnail and auto-indexing behavior. Neither automatic action filters by
URL in Meridian's own code; Chrome's `captureVisibleTab` and `scripting` APIs
refuse to act on `chrome://`, Chrome Web Store, and other extensions' pages, so
those are excluded by Chrome's own restrictions, not by a Meridian allowlist.
The separate, user-requested full refresh does explicitly skip `chrome://`,
`chrome-extension://`, and `about:` tabs in Meridian's code before switching to
them. Meridian makes no network request to a Meridian server.

### Optional permissions (requested only on demand)

**`bookmarks`** *(optional)*
Requested only when the user enables bookmark search in Settings → Local Search
or selects the bookmark scope. Used to read bookmark titles, URLs, and folder
names to return local-search results. No persistent copy of the bookmark tree is
created; denying or revoking it leaves the feature off.

**`history`** *(optional)*
Requested only when the user enables history search in Settings → Local Search or
selects the history scope. Used to read history titles, URLs, and visit times to
return local-search results. No persistent history database is created; denying
or revoking it leaves the feature off.

---

## 5. Owner-only follow-ups (NOT performed from this repository)

These require the publisher's Chrome Web Store dashboard, hosting, and
operational knowledge. **None have been done here — do not mark them complete
until actually performed:**

- **[OWNER-ONLY — NOT DONE]** Publish `PRIVACY.md` at a stable public HTTPS URL
  and enter it in the listing; keep its text matching the shipped archive.
- **[OWNER-ONLY — NOT DONE]** Enter and submit the single-purpose description,
  data-type selections, and the three data-usage certifications in the dashboard.
- **[OWNER-ONLY — NOT DONE]** Confirm each permission justification against the
  exact uploaded archive and paste it into the dashboard field.
- **[OWNER-ONLY — NOT DONE]** Verify prominent-disclosure / affirmative-consent
  requirements for screenshot capture and optional bookmarks/history are met in
  the listing and in-product experience (a policy link alone may not suffice).
- **[OWNER-ONLY — NOT DONE]** Perform a manual network audit of the packed
  release (new-tab, side panel, settings, search, bookmark/history,
  missing-favicon, thumbnail-refresh flows) and confirm no analytics, telemetry,
  or remote code beyond this repository.
- **[OWNER-ONLY — NOT DONE]** Review the current `picsum.photos` and
  search-provider policies/terms, and Chrome's favicon-endpoint guidance, for
  ongoing accuracy.
- **[OWNER-ONLY — NOT DONE]** Reconcile support-contact details, retention/
  deletion statements, and all store-form answers with actual operational
  practice.

---

## 6. Reconciliation notes

Verified against the current source on the "Last updated" date:

- **Manifest ↔ copy** — required permissions (`tabs`, `tabGroups`, `storage`,
  `unlimitedStorage`, `scripting`, `sidePanel`, `favicon`), optional
  (`bookmarks`, `history`), and host access (`<all_urls>`) each have a
  justification above. The repository root manifest and `meridian-extension/`
  manifest are identical.
- **Runtime ↔ copy** — screenshots are JPEG blobs in IndexedDB after
  `captureVisibleTab` (quality 72) and bounded resizing; a display failure keeps
  the stored blob and marks it for replacement on a later natural activation;
  the cache targets a soft ~200 entries / ~50 MB, pruning the oldest thumbnails
  first but never evicting a still-open tab's thumbnail, and always evicting on
  tab close (`utils/thumbnailCache.js`); automatic capture (activation/page
  load) does not filter by URL in code and relies on Chrome's own
  `captureVisibleTab`/`scripting` restrictions, while the user-requested full
  refresh explicitly skips `chrome://`, `chrome-extension://`, and `about:`
  tabs (`background.js`); the extractor reads meta description + H1/H2 only
  (`utils/browserSearch.js`); favicons use the `_favicon` endpoint
  (`utils/favicon.js`); background photos use `picsum.photos` seeds
  (`components/SettingsPanel.js`, 12 photos); `chrome.storage.sync` preference
  data can sync through the user's own Chrome Sync account. No backend/
  telemetry code exists.
- **Terminology** — "workspace lanes," "local search," "thumbnails/screenshots,"
  and "optional bookmarks/history" are used consistently in `README.md`,
  `PRIVACY.md`, and this document.
