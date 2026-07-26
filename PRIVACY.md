# Meridian Privacy Information

Last updated: July 26, 2026

This document describes the behavior of the Meridian source code in this
repository. Meridian is a Chrome extension that runs in the user's browser. The
repository does not contain a Meridian-operated backend, analytics SDK,
advertising SDK, account system, or telemetry uploader. Chrome itself and the
external services listed below may process requests according to their own
settings and policies.

## Data the extension accesses

| Data | How Meridian uses it | Where it is kept |
| --- | --- | --- |
| Open tabs and tab groups | Displays, searches, activates, closes, moves, groups, and restores tabs. This includes tab IDs, titles, URLs, domains, group membership, window IDs, and recent activation state. | A search index and workspace/UI state are stored in `chrome.storage.local`. |
| Open-page metadata | After an open tab finishes loading, reads its meta description and H1/H2 heading text so local tab search can match page context beyond the title and URL. Meridian does not extract form input or other page-body text. Chrome blocks injection into privileged pages, which remain searchable by the tab data Chrome exposes. | Stored only in that tab's entry in the local search index in `chrome.storage.local`; refreshed after later page loads and removed when the tab closes or extension data is cleared. |
| Bookmarks | After the user enables optional bookmark access, displays and searches bookmark titles, URLs, and folder names when the user opens or searches bookmark features. Disabled or ungranted access is not queried. | Results are used in memory; Meridian does not create a persistent copy of the bookmark tree. |
| Browser history | After the user enables optional history access, searches history titles, URLs, and visit times when the user opens or searches history features. Disabled or ungranted access is not queried. | Results are used in memory; Meridian does not create a persistent history database. |
| Screenshots/thumbnails | Captures the visible contents of active tabs after activation or page load and during a user-requested full refresh. A full refresh temporarily cycles through eligible tabs. Screenshots can contain sensitive page content visible at capture time. | JPEG data URLs are kept in `chrome.storage.local`. The cache is limited to 200 entries and approximately 50 MB and evicts a tab's thumbnail when that tab closes. |
| Workspace and UI state | Stores custom workspace names and tab assignments, tab order, collapsed lanes/sidebar sections, the Meridian tab ID, the previous tab ID, and thumbnail cache metadata. | `chrome.storage.local` in the user's Chrome profile. |
| Custom background image | Stores an image selected from the user's device. | IndexedDB in the extension's local origin. Older versions may have left a legacy copy in local extension storage or `localStorage`. |
| Preferences | Stores theme, background selection, search provider, enabled local-search sources, new-tab behavior, optional homepage URL, and domain-grouping preference. | `chrome.storage.sync`. Chrome may sync these values through the user's signed-in Chrome profile, subject to the user's Chrome Sync settings. The uploaded custom image bytes and captured thumbnails are not placed in sync storage. |

Meridian uses the accessed data to provide its tab-management, search,
personalization, and thumbnail features. Repository review found no code that
sells this data, uses it for advertising, or uploads it to a
Meridian-controlled service. This statement is limited to the reviewed source
and is not a verification of any separately published build or store account.

## Favicon handling

The side panel and tab, bookmark, and history search results pass page URLs only
to Chrome's packaged `chrome-extension://.../_favicon/` endpoint to look up
icons through the browser's favicon provider. Meridian does not send those URLs
or domains to the Google S2 favicon service. If Chrome has no icon or the image
cannot load, those surfaces render a generated letter tile from the extension
package instead of contacting a third-party fallback.

## Remaining network behavior

Meridian does not make a background request to its own server, but its UI and
user actions can contact external services:

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
- The code fetches the packaged Meridian SVG through
  `chrome.runtime.getURL`; that is an extension-local resource, not an Internet
  request.

External requests above use HTTPS in the current source. The receiving service
can observe normal request information such as the user's IP address and
browser headers and applies its own privacy policy.

## Permissions

The manifests request these installed capabilities:

- `tabs` and `tabGroups`: read tab titles and URLs and manage tabs and groups.
- `storage` and `unlimitedStorage`: retain preferences, workspaces, search
  metadata, thumbnails, and custom backgrounds.
- `favicon`: use Chrome's packaged favicon provider.
- `sidePanel`: provide the Meridian side-panel UI.
- `scripting`: run the one-shot metadata extractor after an open tab finishes
  loading. This remains installed because indexing happens automatically rather
  than from a user click; the extractor reads only the page's meta description
  and H1/H2 heading text.
- `<all_urls>` host access: allow automatic visible-tab thumbnail capture after
  activation or page load, a user-requested full refresh, and the one-shot
  metadata extractor after page load. This access remains installed because
  Chrome's click-scoped `activeTab` permission cannot authorize those automatic
  background actions.

`bookmarks` and `history` are optional permissions. Chrome prompts only when the
user enables the matching Local Search setting or selects that search scope.
Denial leaves the source off. Disabling the setting removes the grant, and
revocation through Chrome also turns off the saved source and prevents further
queries.

Chrome blocks extension access to some privileged pages. Meridian catches those
access failures and leaves the unavailable tab details or thumbnail empty.

## Retention and control

Most persistent data remains inside the extension's local or sync storage until
it is replaced, evicted, manually cleared, or removed during extension or
profile cleanup. Bookmark and history queries do not create a separate
persistent copy. Closing a tab requests deletion of its cached thumbnail and
tab-search entry, including extracted metadata. Users can also clear extension
data through Chrome's site/extension data controls. Bookmark and history access
can be removed from Meridian's Local Search settings or Chrome's extension
controls.

## Chrome Web Store disclosure checklist

This checklist is intentionally not a claim that a Chrome Web Store submission
has been reviewed or approved. The publisher should complete it against the
exact release archive and the answers in the store dashboard.

- [ ] Publish an accessible privacy-policy URL whose text matches the shipped
      release and store listing.
- [ ] Verify that the listing and in-product experience provide every prominent
      disclosure and affirmative consent required for the release's data
      handling; a privacy-policy link alone may not satisfy those requirements.
- [ ] Disclose handling of browsing-history data, including open-tab,
      bookmark, history, URL, title, and domain information.
- [ ] Disclose handling of website content, including extracted metadata,
      tab titles/URLs and captured visible-tab screenshots. The shipped
      metadata extractor reads meta descriptions and H1/H2 heading text.
- [ ] Evaluate and disclose user-activity data represented by tab activation,
      previous-tab state, grouping, ordering, and workspace assignments.
- [ ] Evaluate the uploaded custom background under the store's
      user-provided-content categories.
- [ ] Declare only the product-functionality and personalization purposes that
      match the release, and independently confirm the store's limited-use,
      sale, advertising, and human-access attestations.
- [ ] Provide a current justification for every requested permission,
      especially persistent `<all_urls>` and `scripting`, optional `history`
      and `bookmarks`, visible-tab capture, and `unlimitedStorage`.
- [ ] Verify that provider-icon and Picsum requests are reflected in the
      disclosure and assess the current policies/terms of those services.
- [ ] Perform a manual network audit of the packed release across the new-tab
      page, side panel, settings, search, bookmark/history, missing-favicon,
      and thumbnail-refresh flows.
- [ ] Confirm that the release archive contains no unreviewed analytics,
      telemetry, remote code, or other behavior absent from this repository
      review.
- [ ] Reconcile all store-form answers, data-use certifications, support
      contact details, and retention/deletion statements with the publisher's
      actual operational practices.

Repository inspection alone cannot verify the Chrome Web Store dashboard,
publisher practices, deployed policy URL, third-party policy changes, or that a
published archive is byte-for-byte equivalent to this source.

Publisher references:

- [Chrome's Manifest V3 favicon endpoint](https://developer.chrome.com/docs/extensions/how-to/ui/favicons)
- [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Chrome Web Store user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
