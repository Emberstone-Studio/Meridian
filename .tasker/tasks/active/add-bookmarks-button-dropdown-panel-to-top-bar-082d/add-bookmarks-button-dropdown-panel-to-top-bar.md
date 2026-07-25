Implemented the bookmarks top-bar control and dropdown panel in both mirrored extension source trees.

- Added a round bookmark icon beside the existing new-group and settings controls.
- Added flat Bookmarks Bar and All Bookmarks views with an in-panel view switch, empty states, outside-click dismissal, and Escape dismissal.
- Flattened folder descendants while excluding the Bookmarks Bar subtree from All Bookmarks.
- Reused Meridian's `focus-pinned` new-tab behavior resolution: pinned mode opens a new tab; other modes navigate the current tab.
- Uses Chrome's local `/_favicon/` provider only; no third-party favicon service.
- Confirmed both manifests already contain the required `bookmarks` and `favicon` permissions, so no conflicting manifest edit was needed.

Validation:
- `node --check components/BookmarksButton.js`
- `node --check meridian.js`
- `node --test tests/*.test.mjs` - 8/8 passed
- `git diff --check`
- Root and `meridian-extension/` JS, CSS, HTML, and component mirrors match byte-for-byte.