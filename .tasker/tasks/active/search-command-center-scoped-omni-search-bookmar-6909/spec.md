# Search Command Center — Interaction Spec

## Goal
Turn the search bar into a scoped "command center." Today the omni field already
searches across open tabs, bookmarks, and history and renders grouped results
(`#browser-search-results`), plus a live filter of the tab grid and a provider
web-search fallback. The gaps this addresses:

1. **Discoverability** — nothing before the first keystroke signals the field
   searches more than the web. The left icon is a provider (engine) logo and the
   placeholder is generic ("Search…"), so scope is invisible until you've already
   typed — the teaching moment is gated behind the action it's meant to encourage.
2. **No way to narrow.** Users can't focus the search on a single source.

## Model
- **One primary field** + a right-side cluster of **scope chips** and a **Settings** launcher.
- **Scopes** (mutually exclusive; resting state = *All / omni*):
  - **All** (default) — search everything, grouped results, web-search row.
  - **Bookmarks** — bookmarks only.
  - **History** — recent history only.
- **Settings** is a modal launcher, NOT a field mode. Separated from the scope
  chips by a hairline divider (it leaves the surface; the others don't).
- **New Group is removed from this row** and relocated to the workspace bottom
  (see Increment 2).

### Why Tabs gets no chip
Omni searches tabs + bookmarks + history, but scope chips only surface the sources
that are *not already on screen*. Open tabs are visible as cards and are already the
live-filter target, so a tabs-only scope would re-show what's visible. Bookmarks and
history are the hidden archives — those earn a scope. The chips reveal the invisible.

## Mode table

| Mode | Left glyph | Placeholder | Field content (below) | Enter | Exit |
|---|---|---|---|---|---|
| **All** (default) | magnifier | "Search everything…" | grouped: Open Tabs / Bookmarks / History + web-search row (provider ▾) | act on highlighted result, else web search | is the resting state |
| **Bookmarks** | bookmark | "Search bookmarks…" | bookmarks only, live-filtered; empty → all bookmarks (folder order) | open highlighted bookmark | Esc / click active chip → All |
| **History** | clock | "Search history…" | recent history; empty → most-recent list | open highlighted history item | Esc / click active chip → All |
| **Settings** | gear | — | — (opens modal) | — | modal handles |

## Signifiers (the guardrails against "typed into the wrong mode")
- **Mode shown twice at once**: active left glyph + matching placeholder.
- **Active scope chip highlighted** (aria-pressed). Inactive chips are quiet icons.
- **Neutral magnifier owns the left slot in All mode** — scope signal, not an engine.
  Provider identity moves onto the **web-search result row** ("Search DuckDuckGo for
  '<q>' ▾"), where it's contextually relevant and only appears when there's a query.
  Provider persists via `chrome.storage.sync` (already implemented), so a one-time
  pick sticks; it is simply not rendered in Bookmarks/History modes.
- **Scope-name placeholder** ("Search everything…") names the breadth before typing.

## Empty-state rule (reconciles "no empty-focus noise")
- **All, empty → no dropdown.** No unsolicited results = no noise.
- **Bookmarks / History, empty → show that source's list.** Entering the scope IS the
  request, like opening a filing drawer shows its contents. Not noise — the point.

Defaults: empty **Bookmarks** = all bookmarks in folder order (deterministic;
revisit if date-added recency is added). Empty **History** = most-recent first.

## Rules
- **All is the star and the resting state.** Scoping is optional narrowing, never a
  required first step — new users can just type and get everything.
- Return to All on: Esc, or clicking the active chip.
- **Query text clears on scope switch** (carrying a tab query into bookmarks scope
  would mislead).
- **On blur**: empty field → revert to All; non-empty → hold the scope until Esc.

## Accessibility
- Scope chips = toggle buttons conveying current scope (`aria-pressed`); field
  `aria-label` updates per mode with an `aria-live` announcement on switch.
- Settings = button `aria-haspopup="dialog"`.
- Results list = arrow-navigable listbox (ArrowDown into results already wired).

## Layout
Command row (3-column grid already in place: `1fr | minmax(0,600px) | 1fr`):
`[🔍 field ....................]   [🔖][🕘]  |  [⚙]`
- Field in the centered middle column; chip cluster right-aligned, bottom-aligned to
  the field (as today).
- Chips + settings share the existing 36px circular button style. Divider before
  Settings.

---

# Build Increments

## Increment 1 — Scope engine + chips (this task's core)
**`utils/browserSearch.js`**
- Add `listBookmarks(limit?)` — `chrome.bookmarks.search({query:""})` (or getTree),
  URL nodes only, folder name as `context`, mapped to the existing ResultItem shape.
- Add `listRecentHistory(limit=25)` — `chrome.history.search({text:"", maxResults})`,
  date as `context`, same ResultItem shape.
- Leave `search(query)` as-is (already returns `{tabs, bookmarks, history}`).

**`components/SearchBar.js`**
- Add scope state: `'all' | 'bookmarks' | 'history'` (default `'all'`).
- Left slot: show provider logo button in `all`; swap to a static scope glyph
  (bookmark / clock) in scoped modes. Placeholder swaps per scope.
- `input` events call `onBrowserQuery(query, scope)`. On scope change, clear the
  input and re-emit so the empty-scope list renders.
- Extend the returned api: `setScope(scope)`, `getScope()`, `onScopeChange`.
- `doSearch()` (web search) only applies in `all` scope. Enter in scoped modes opens
  the highlighted result.

**`meridian.js`**
- `onBrowserQuery(query, scope)`:
  - `all` → existing `handleBrowserQuery` behavior (filter grid + grouped results + web row).
  - scoped + query → `search(query)`, render only that section.
  - scoped + empty → `listBookmarks()` / `listRecentHistory()`, render that section.
  - Do NOT filter the tab grid in scoped modes (scope is about the archive, not tabs).
- `renderSearchResults(results, query, scope)` — when scoped, render only the active
  section and suppress the web-fallback row (web belongs to `all`).

**Row (HTML/CSS, both copies)**
- Repurpose the `#bookmarks-btn` into the **Bookmarks scope chip**; add a **History
  scope chip**; keep **Settings** with a divider before it.
- **Supersede** the standalone `#bookmarks-panel` popup (retire its open-on-click;
  Bookmarks scope replaces it). Confirmed acceptable to drop the separate popup.
- Active chip styling (`aria-pressed`/`.active`).

## Increment 2 — Relocate New Group
- Remove `#new-group-btn` from the top row.
- Add an **"Add a new group"** affordance at the workspace bottom, mirroring the
  new-tab-card: idle `+` that expands inline into a "Group name…" field; Enter
  creates, Esc cancels. Reuses the new-tab-card interaction pattern.
- Presentation: full-width "＋ New group" row beneath the last group (preferred, so
  it isn't mistaken for adding a card) — confirm against how groups render as lanes.

## Deferred polish (not in scope for v1)
- Expand/collapse choreography (omni field collapsing to an icon while the scoped
  field expands). v1 is scope-toggle-in-place — functionally identical; animation is
  additive later.

## Files (mirror ALL changes across both copies)
- `components/SearchBar.js` + `meridian-extension/components/SearchBar.js`
- `utils/browserSearch.js` + `meridian-extension/utils/browserSearch.js`
- `meridian.js` + `meridian-extension/meridian.js`
- `meridian.html` + `meridian-extension/meridian.html`
- `meridian.css` + `meridian-extension/meridian.css`

## Acceptance
- Default field reads "Search everything…" with a magnifier; grouped results and web
  row work exactly as today.
- Clicking Bookmarks/History narrows results to that source, swaps glyph + placeholder,
  highlights the active chip; empty scope lists the source; Esc/active-chip returns to All.
- Provider selection still works (on the web row in All) and persists.
- Settings still opens the modal.
- New Group creatable from the workspace-bottom affordance.
- All behavior identical in both root and `meridian-extension` copies.
