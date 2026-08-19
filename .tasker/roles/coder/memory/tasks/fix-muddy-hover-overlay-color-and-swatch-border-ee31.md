<!-- [task-doc-auto:fix-muddy-hover-overlay-color-and-swatch-border-ee31] -->
# Fix swatch/border animation desync on preset swatch hover
_Auto-recorded on completion (2026-08-19T18:45:38.115Z)._

Implemented the preset swatch hover/outline synchronization fix.

- Moved the preset selected state to `.settings-bg-preset`, so the wrapper owns both the outline and hover transform.
- Matched the custom-photo transition properties, duration, and easing for `box-shadow` and `transform`.
- Kept source and packaged extension copies synchronized.
- Added regression assertions for selected-state placement and the shared transition contract.
- Left the hover overlay darkening color unchanged.

Validation:
- `node --test tests/*.test.mjs` — 137/137 passing.
- Headless Chromium computed-style check — preset and custom tiles both use `box-shadow, transform`, `0.15s`, `ease`, and reach the same `scale(1.05)` hover geometry.
- `git diff --check` and packaged parity checks pass.
