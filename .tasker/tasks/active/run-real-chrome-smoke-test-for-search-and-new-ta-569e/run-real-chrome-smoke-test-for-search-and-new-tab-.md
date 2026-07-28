## Validation complete

Updated `RELEASE_VALIDATION.md` with the clean-profile Chrome for Testing 151.0.7922.47 release matrix, exact launch/procedure details, headed New Tab/omnibox evidence, navigation/search/accessibility/permissions/settings/grouping/thumbnail/side-panel coverage, reload and restart persistence, console diagnostics, limitations, and concrete blocker fixes.

### Verification

- `node --test tests/*.test.mjs`: 74 passed, 0 failed.
- `node --check`: 48 JavaScript files passed.
- Source/package SHA-256 parity: 31 pairs, 0 mismatches.
- `git diff --check`: passed.
- Final worktree delta: only `RELEASE_VALIDATION.md`.

### Real Chrome results

- Headed `Ctrl+T`: Windows UI Automation identified `Address and search bar` (`OmniboxViewViews`) as the actual focused control. Typing `meridian-focus-probe-569e` populated the omnibox while the Meridian input stayed empty, even though the document reported `.search-input` as `activeElement`. Meridian's autofocus attempt does not override Chrome's omnibox.
- Focus-pinned, pinned/unpinned navigation, direct URL recognition, DuckDuckGo Web search, query retention, Arrow/Enter/Escape behavior, pointer/keyboard synchronization, live announcements, popup placement/scrolling, access-off/deny/allow/revoke flows, native grouping, 18 thumbnails, actual side panel behavior, reload persistence, and clean browser restart persistence were exercised.
- Extension page, actual side panel, and service worker produced 0 runtime exceptions, console/log errors, or unhandled rejections. Two handled thumbnail warnings are documented.

### Release blockers found

1. **High:** Opening Settings from an active Bookmarks/History scope with a retained query immediately closes Settings when the asynchronous all-results popup opens (`meridian.js:653`, `meridian.js:775`). Invalidate the pending browser search before Settings takes ownership.
2. **High accessibility:** Switching directly between already-open Bookmark and History scopes leaves the listbox visible and selectable while the combobox reports `aria-expanded="false"` (`components/SearchBar.js:122`, `components/SearchPopup.js:32`). Re-synchronize open listeners/state for an already-visible popup.

The validation task is complete; the extension release itself remains blocked on those two documented defects.