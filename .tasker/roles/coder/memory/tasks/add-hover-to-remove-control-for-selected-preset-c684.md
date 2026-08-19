<!-- [task-doc-auto:add-hover-to-remove-control-for-selected-preset-c684] -->
# Add hover-to-remove control for selected color/photo/theme backgrounds
_Auto-recorded on completion (2026-08-19T18:22:00.990Z)._

Implemented hover-to-remove controls for selected color, gradient, stock-photo, and topo presets. Removing a preset restores the theme-aware topo default. Replaced the diagonal No background swatch with a complementary Garnet solid, added the topo default to the balanced 12-slot photo grid, and mirrored all component/CSS changes into meridian-extension. Added focused regression coverage. Validation: syntax checks passed, git diff whitespace check passed, source/package parity passed, and all 137 Node tests passed.
