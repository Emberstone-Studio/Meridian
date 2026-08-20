Implemented the lane-header inverse-text treatment and removed the rejected scrim.

- Removed the full-width `.lane-header::before` backdrop, local token overrides, and isolated stacking context from both runtime stylesheets.
- Applied `color: #fff` plus `mix-blend-mode: difference` to resting titles, counts, delete controls, and collapse controls; the SVG chevron follows `currentColor`.
- Preserved surface-backed title focus/editable-hover, collapse-hover, and delete-hover states with normal blending.
- Restored the lane count to `opacity: 0.85`.
- Removed the now-unused global on-background luminance/token pipeline while retaining dominant-color accent analysis.
- Reworked lane-header coverage to assert direct inverse blending, absence of a scrim/isolation, chevron inheritance, and normal interactive-state blending.

Validation:
- Chromium visual checks passed on `img/landscape.jpg` in light and dark themes, plus near-black and near-white solid backgrounds; no header bar was present.
- Source/package CSS and SettingsPanel copies are byte-identical.
- `git diff --check` passes.
- Full suite: **159 passed, 0 failed** via `node --test tests/*.test.mjs`.