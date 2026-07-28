Implemented the scoped search command center and New Group relocation.

- Added toggleable Bookmarks and History scope chips with mode-specific glyphs and placeholders.
- Preserved empty omni behavior while empty scoped modes list bookmarks or recent history.
- Restricted scoped queries/results to their selected source and made Enter open the first scoped result.
- Moved New Group from the top actions to a workspace-bottom **Add a new group** affordance.
- Kept the root extension and `meridian-extension` mirror synchronized.
- Added scoped search tests; all 16 tests pass.
- Commit: `b6c0ef4 Add scoped search command center`