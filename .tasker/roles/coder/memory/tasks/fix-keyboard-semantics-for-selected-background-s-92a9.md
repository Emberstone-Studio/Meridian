<!-- [task-doc-auto:fix-keyboard-semantics-for-selected-background-s-92a9] -->
# Fix keyboard semantics for selected background swatch removal
_Auto-recorded on completion (2026-08-19T20:10:00.165Z)._

Implemented the selected preset swatch keyboard/accessibility fix.

- Replaced the interactive preset wrapper with a non-interactive visual tile.
- Added sibling native selection and remove buttons, with selection state exposed through `aria-pressed`.
- Kept hover scaling, selected ring, overlay removal geometry, and visible keyboard focus on the tile footprint.
- Added bubbling Enter and Space regression coverage on the focused remove button, plus mouse selection/removal assertions.
- Mirrored component and CSS changes in `meridian-extension`.

Verification:
- `node --test tests/*.test.mjs` — 154 passed, 0 failed.
- Source/package component and CSS comparisons — exact match.
- `git diff --check` — clean.
