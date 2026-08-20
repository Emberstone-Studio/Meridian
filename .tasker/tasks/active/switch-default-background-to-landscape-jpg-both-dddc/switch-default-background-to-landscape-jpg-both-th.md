Implemented the landscape wallpaper default in both runtime trees.

- All light, system-dark, and explicit-dark `--default-bg-image` declarations now use `img/landscape.jpg`.
- Added the byte-identical landscape asset to `meridian-extension/img/landscape.jpg`.
- Confirmed the brand lock is filename-agnostic: the shipped default is recognized by its semantic theme token and clears derived accent overrides, preserving hue 166 / saturation 69% with theme-specific lightness. Added regression assertions for this behavior.
- Kept all existing topo assets untouched.
- Confirmed neither manifest enumerates `web_accessible_resources`, so no manifest change is required for this extension-owned CSS asset.
- Validation: `node --test tests/*.test.mjs` passed all 156 tests; `git diff --check` and source/package parity checks passed.