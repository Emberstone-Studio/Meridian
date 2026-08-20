<!-- [task-doc-auto:group-lane-label-text-isn-t-legible-across-gradi-ddd0] -->
# Group/lane label text isn't legible across gradient backgrounds (single global luminance sample)
_Auto-recorded on completion (2026-08-20T16:06:25.909Z)._

Implemented a local contrast surface for every lane header.

- Scoped the on-background text variables to each .lane-header and placed them over a 94%-opaque, blurred theme surface, eliminating dependence on one wallpaper-wide luminance sample.
- Strengthened the muted token with a primary/secondary mix and removed the tab-count opacity that reduced effective contrast.
- Mirrored runtime changes into meridian-extension and updated the luminance-solver comments to document the local override.
- Added regression coverage proving the scoped scrim exists and that muted labels retain at least 4.5:1 contrast over worst-case black and white wallpaper pixels in light and dark themes.

Verification: node --test tests/*.test.mjs passed all 158 tests; git diff --check passed; packaged CSS and SettingsPanel sources match. Headed Chromium screenshots using img/landscape.jpg confirmed legible upper and lower lane headers in explicit light and dark themes.
