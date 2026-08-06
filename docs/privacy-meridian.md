# Meridian Privacy Information

Last updated: July 26, 2026

Meridian is a Chrome extension that runs entirely in your browser. Meridian has
no Meridian-operated backend, analytics SDK, advertising SDK, account system,
or telemetry uploader. Chrome itself and the external services listed below
may process requests according to their own settings and policies.

## Chrome Web Store Limited Use adherence

Meridian's use of information received from Chrome APIs adheres to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements:

- Meridian accesses and processes tab data, page metadata, captured
  screenshots, and optional bookmarks/history **only to provide and improve the
  user-facing tab-management, local-search, personalization, and thumbnail
  features described below**, in response to user actions or automatic in-browser
  indexing.
- Meridian **does not transfer this data to any Meridian-operated server**;
  Meridian has no backend, account system, analytics SDK, advertising SDK, or
  telemetry uploader. Data stays in your Chrome profile (`chrome.storage.local`,
  `chrome.storage.sync`, and IndexedDB) except where your own actions navigate
  the browser or contact the third-party services listed under "Remaining
  network behavior."
- Meridian **does not sell** user data, **does not use or transfer it for
  advertising, credit-scoring, or lending**, and **does not use it for purposes
  unrelated to the extension's single visible purpose**.
- Meridian **does not allow humans to read** this data. No one at the
  publisher can read tab, metadata, screenshot, bookmark, or history data,
  because none of it leaves your device to a publisher-controlled system.

## Data the extension accesses

| Data | How Meridian uses it | Where it is kept |
| --- | --- | --- |
| Open tabs and tab groups | Displays, searches, activates, closes, moves, groups, and restores tabs. This includes tab IDs, titles, URLs, domains, group membership, window IDs, and recent activation state. | A search index and workspace/UI state are stored in `chrome.storage.local`. |
| Open-page metadata | After an open tab finishes loading, reads its meta description and H1/H2 heading text so local tab search can match page context beyond the title and URL. Meridian does not extract form input or other page-body text. Chrome blocks injection into privileged pages, which remain searchable by the tab data Chrome exposes. | Stored only in that tab's entry in the local search index in `chrome.storage.local`; refreshed after later page loads and removed when the tab closes or extension data is cleared. |
| Bookmarks | After you enable optional bookmark access, displays and searches bookmark titles, URLs, and folder names when you open or search bookmark features. Disabled or ungranted access is not queried. | Results are used in memory; Meridian does not create a persistent copy of the bookmark tree. |
| Browser history | After you enable optional history access, searches history titles, URLs, and visit times when you open or search history features. Disabled or ungranted access is not queried. | Results are used in memory; Meridian does not create a persistent history database. |
| Screenshots/thumbnails | Captures the visible contents of active tabs after activation or page load, and during a user-requested full refresh. Automatic captures (after activation or page load) do not check the tab's URL first; Chrome's own `captureVisibleTab` API refuses privileged pages such as `chrome://`, the Chrome Web Store, and other extensions' pages, so those attempts fail and store nothing. A user-requested full refresh additionally skips `chrome://`, `chrome-extension://`, and `about:` tabs before switching to them, so it never focuses those tabs at all. Any other page — including one with sensitive content visible on screen — is captured the same way in both cases. | JPEG blobs are kept in IndexedDB in the extension's local origin; cache metadata and refresh markers are kept in `chrome.storage.local`. Older data-URL entries are migrated into IndexedDB. Storage targets roughly 200 entries and 50 MB, pruning the oldest thumbnails first when over target, but a thumbnail for a tab that is still open is never evicted to make room — actual usage can exceed the target while those tabs stay open. A display/decode error does not delete the stored blob. A tab's thumbnail is removed when that tab closes. |
| Workspace and UI state | Stores custom workspace names and tab assignments, tab order, collapsed lanes/sidebar sections, the Meridian tab ID, the previous tab ID, and thumbnail cache metadata. | `chrome.storage.local` in your Chrome profile. |
| Custom background image | Stores an image you select from your device. | IndexedDB in the extension's local origin. Older versions may have left a legacy copy in local extension storage or `localStorage`. |
| Preferences | Stores theme, background selection, search provider, enabled local-search sources, new-tab behavior, optional homepage URL, and domain-grouping preference. | `chrome.storage.sync`. Chrome may sync these values through your signed-in Chrome profile, subject to your Chrome Sync settings — this means these preferences can travel to your other signed-in devices; it is not Meridian-operated syncing. The uploaded custom image bytes and captured thumbnails are not placed in sync storage. |

Meridian uses the accessed data to provide its tab-management, search,
personalization, and thumbnail features. It does not sell this data, use it
for advertising, or upload it to a Meridian-controlled service.

## Favicon handling

The side panel and tab, bookmark, and history search results pass page URLs only
to Chrome's packaged `chrome-extension://.../_favicon/` endpoint to look up
icons through the browser's favicon provider. Meridian does not send those URLs
or domains to the Google S2 favicon service. If Chrome has no icon or the image
cannot load, those surfaces render a generated letter tile from the extension
package instead of contacting a third-party fallback.

## Remaining network behavior

Meridian does not make a background request to its own server, but its UI and
your actions can contact external services:

- Search-provider icons are loaded from fixed icon URLs at Google,
  DuckDuckGo, Bing, and Brave. These fixed requests do not contain a visited
  tab, bookmark, or history URL.
- New-tab-page cards and their preview can display the `favIconUrl` supplied by
  Chrome for an open tab. Depending on Chrome's cache, displaying that URL can
  request the icon from the site or the site's chosen icon host; it is not a
  Google S2 lookup.
- Opening the background settings loads photo thumbnails from
  `picsum.photos`. Selecting a Picsum photo loads the chosen full-size image
  from that service. The generated photo seed is part of the request URL.
- Starting a web search opens a tab at the selected provider (Google,
  DuckDuckGo, Bing, or Brave) with the search text in the URL.
- Choosing the custom-homepage behavior or opening a tab, bookmark, or history
  result navigates Chrome to the selected URL. The destination then receives a
  normal browser navigation.
- The Settings panel's Emberstone Studio footer shows two outbound links — the
  studio site (`https://emberstone-studio.com`) and a Ko-fi donation page
  (`https://ko-fi.com/emberstonestudio`). Both are inert until you explicitly
  click one, which opens that destination in a new tab. Meridian performs no
  background request for them and adds no click tracking or analytics.
- The code fetches the packaged Meridian SVG through
  `chrome.runtime.getURL`; that is an extension-local resource, not an Internet
  request.

External requests above use HTTPS. The receiving service can observe normal
request information such as your IP address and browser headers and applies
its own privacy policy.

## Permissions

Meridian requests these installed capabilities:

- `tabs` and `tabGroups`: read tab titles and URLs and manage tabs and groups.
- `storage` and `unlimitedStorage`: retain preferences, workspaces, search
  metadata, thumbnails, and custom backgrounds across local storage and
  IndexedDB. Thumbnail data can exceed the
  default storage quota, so `unlimitedStorage` lets the cache hold a useful
  number of entries; Meridian still targets roughly 200 entries / 50 MB and
  prunes the oldest thumbnails first, but never evicts a still-open tab's
  thumbnail, so usage can exceed that target while those tabs stay open.
- `favicon`: use Chrome's packaged favicon provider.
- `sidePanel`: provide the Meridian side-panel UI.
- `scripting`: run the one-shot metadata extractor after an open tab finishes
  loading. This is required because indexing happens automatically rather
  than from a user click; the extractor reads only the page's meta description
  and H1/H2 heading text.
- `<all_urls>` host access: allow automatic visible-tab thumbnail capture after
  activation or page load, a user-requested full refresh, and the one-shot
  metadata extractor after page load. This access is required because
  Chrome's click-scoped `activeTab` permission cannot authorize those automatic
  background actions. Automatic captures and the metadata extractor do not
  filter by URL in Meridian's code; privileged pages (`chrome://`,
  `chrome-extension://`, the Chrome Web Store, other extensions' pages) are
  excluded only because Chrome's `captureVisibleTab` and `scripting` APIs
  refuse to act on them. The user-requested full refresh additionally skips
  `chrome://`, `chrome-extension://`, and `about:` tabs in Meridian's own code
  before switching to them.

`bookmarks` and `history` are optional permissions. Chrome prompts only when
you enable the matching Local Search setting or select that search scope.
Denial leaves the source off. Disabling the setting removes the grant, and
revocation through Chrome also turns off the saved source and prevents further
queries.

Chrome blocks extension access to some privileged pages. Meridian catches those
access failures and leaves the unavailable tab details or thumbnail empty.

## Retention and control

Most persistent data remains inside the extension's local or sync storage until
it is replaced, evicted, manually cleared, or removed during extension or
profile cleanup — it is not session data that deletes automatically. Bookmark
and history queries do not create a separate persistent copy. Closing a tab
requests deletion of its cached thumbnail and tab-search entry, including
extracted metadata. You can also clear extension data through Chrome's
site/extension data controls. Bookmark and history access can be removed from
Meridian's Local Search settings or Chrome's extension controls.

## References

- [Chrome's Manifest V3 favicon endpoint](https://developer.chrome.com/docs/extensions/how-to/ui/favicons)
- [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Chrome Web Store user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
