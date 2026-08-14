# Meridian — Chrome Web Store listing copy

Last updated: August 14, 2026

Paste-ready values for the Web Store dashboard fields.

**The description fields are plain text — Markdown does not render.** Copy the
blocks below exactly, including the `•` characters. Do not convert them to
Markdown.

---

## Name
Meridian

## Summary (short description, max 132 — this is 109)

```
Spatial tab command center — a visual new-tab page that turns your open tabs into searchable thumbnail cards.
```

## Category
Workflow & Planning

## Description

```
Meridian replaces your new-tab page with a spatial command center for your open tabs.

Your tabs appear as live thumbnail cards, organized into workspace lanes that map to Chrome tab groups or to custom groups you create in Meridian. Drag to reorder tabs within and across groups, collapse lanes you are not using, and hover a card to open a full-size preview with the tab's title and URL.

FEATURES

• Tab cards and workspace lanes — every open tab as a live thumbnail, grouped into collapsible lanes with drag-and-drop reordering.
• Local search — instantly find open tabs by title, URL, domain, and page context.
• Side panel — open Meridian's search from Chrome's side panel with the toolbar icon, without leaving the page you are on.
• Bookmarks and history panel — reach bookmarks and recent history from a dropdown in the top bar, with site icons and one-click open. Both sources are optional and stay off until you turn them on.
• Multi-engine web search — search with Google, DuckDuckGo, Bing, or Brave from the top of every new-tab page; your choice is remembered.
• Theming and backgrounds — Light, Dark, or System theme; solid colors, gradient presets, curated photos, or your own uploaded image.
• Tab organization — optionally cluster ungrouped tabs by domain.
• Flexible new-tab behavior — open a fresh Meridian view, return to a pinned Meridian tab, or load a custom homepage.
• Keyboard-first — jump to Meridian, move between tabs and lanes, focus search, and create groups without the mouse.

PRIVACY

Meridian runs entirely in your browser. It has no accounts, no analytics, and no Meridian-operated server. Your tab, page, screenshot, bookmark, and history data stays in your Chrome profile. Full details are in the extension's privacy policy.
```

## Support URL
`https://emberstone-studio.com/`

## Privacy policy URL
`https://emberstone-studio.com/docs/privacy/meridian`

Publish `docs/privacy-meridian.md` there first — the in-product Settings link
already points to it.

## Graphics
In `store-assets/`: 5 screenshots (1280×800), promo tile (440×280), marquee
(1400×560). Icon is `img/icon128.png`.

---

# Privacy tab

## Single purpose
Meridian is a new-tab replacement that helps users view, search, and organize
their open browser tabs as a visual, spatial workspace. Every permission and
data access exists to render tabs as searchable thumbnail cards, to search local
browser data the user opts into, and to personalize the new-tab surface.

## Data types — check these three
- **Web browsing activity** — tab titles, URLs, domains, group membership,
  activation state; plus bookmarks/history only if the user enables them.
- **Website content** — meta description and H1/H2 text read after page load,
  and JPEG screenshots of active tabs for thumbnails.
- **User activity** — tab activation, grouping, ordering, workspace assignments.

Everything else (PII, health, financial, authentication, communications,
location) is **No**.

## Certifications — check all three
Confirm against the uploaded archive first.

- ☑ Not sold to third parties outside approved use cases.
- ☑ Not used or transferred for purposes unrelated to the single purpose.
- ☑ Not used to determine creditworthiness or for lending.

---

# Permission justifications

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
default storage quota. `unlimitedStorage` lets the local thumbnail cache hold
enough entries to be useful. Code targets roughly 200 entries / ~50 MB and prunes
the oldest thumbnails first when over that target, but never evicts a thumbnail
for a tab that is still open — so actual usage can exceed the target while those
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

# Before you submit

- Publish the privacy policy at the URL above.
- Answer the **trader** declaration. Declaring trader publishes your address and
  phone on the listing. The Ko-fi link in Settings bears on this.
- Upload the current screenshots — the ones in `store-assets/` were replaced.
- `manifest.json`'s `description` is "Spatial tab command center" (26 chars) and
  does not match the summary above. Pick one.
- The Details tab (version, size, languages, developer) fills itself from the
  package and your account. Nothing to write.

Data-handling detail lives in `docs/privacy-meridian.md` — that's the policy
content, not listing copy.
