Implemented the Background panel follow-up fixes in the source and packaged-extension mirrors.

- Removed scale-up behavior from selected presets while preserving the hover remove overlay.
- Constrained the four-column grids with `minmax(0, 1fr)` and zero-minimum preset wrappers so content cannot consume the right gutter.
- Removed the Topographic fallback from the Photos grid and restored the grid to 11 stock photos plus the custom tile.
- Replaced Garnet with a true white `#ffffff` preset labeled White.
- Updated regression coverage for all four changes.

Validation: `node --test tests/*.test.mjs` passed 137/137; mirror parity checks and `git diff --check` passed.