Implemented the reviewer rework for direct Bookmark/History scope switching.

- Updated the shared popup so an idempotent `open()` call re-notifies combobox bindings, restoring `aria-expanded="true"` when the scope shell is already visible.
- Kept the root and packaged extension `SearchPopup.js` copies identical.
- Added a bidirectional regression covering Bookmarks ? History and History ? Bookmarks. It verifies the scoped listbox stays visible, `aria-controls` remains correct, `aria-expanded` stays true, and the prior `aria-activedescendant` is cleared until a new option is selected.
- Focused keyboard/ARIA smoke suite: 25/25 passing.
- Full repository suite: 77/77 passing.
- `git diff --check`: clean.