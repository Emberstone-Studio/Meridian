## Background transparency + blur sliders (Photos-only)

Added two live-preview sliders (**Transparency** and **Blur**) plus a **fade-to-black/white** fallback toggle, nested/indented directly under the **Photos** section of the settings Appearance panel. They render only for image backgrounds and are absent for Colors & Gradients / None.

### Behavior delivered
- **Photo-only.** The nested control block is rendered only when a `photo` or `custom` (uploaded image) background is active; selecting any color/gradient/none background removes it and neutralizes the modifiers (`--photo-opacity:1`, `--photo-blur:0px`, fade `transparent`), so those backgrounds are untouched.
- **Transparency fades toward the sampled accent.** The photo dissolves toward `var(--accent)` — the exact color already canvas-sampled for the UI accent — so background, accent, and fade all derive from one source. A manual **“Fade to black/white instead of accent”** toggle switches the wash to `#fff` (light) / `#000` (dark) via a theme-reactive `--photo-fade-bw` var, letting the designer eyeball both.
- **Blur** uses standard CSS `filter: blur()`.
- **Live preview.** Dragging either slider updates CSS custom properties immediately (no settings reopen). Values persist to `chrome.storage.sync` (`photoAdjust`) on gesture end, and cross-tab changes re-apply live.
- **No re-sampling on slider ticks.** Pixel sampling (`applyAccentFromBackground`) runs once when the photo is selected/changed. Sliders only interpolate opacity/blur against the cached, live `--accent` var; the photoAdjust `onChanged` path re-applies CSS vars without ever re-sampling.

### Implementation
- **`meridian.css`** — Moved the base color to `html { background-color: var(--bg) }` (paint step 1 / canvas) and moved the wallpaper into two fixed, negative-z-index `body` pseudo-layers so photo blur/opacity never touch the foreground UI:
  - `body::before` (z-index -2): the fade wash — `var(--photo-fade-color)`.
  - `body::after` (z-index -1): the image/gradient with `opacity: var(--photo-opacity)` and `filter: blur(var(--photo-blur))`; its box is grown by `inset: calc(-2 * var(--photo-blur))` so blurred edges never reveal a gap.
  - Added `--photo-fade-bw` (`#fff` light / `#000` dark) to all three theme blocks, plus `.settings-bg-photo-adjust` / `.settings-slider*` styles (left accent rail + tint to signal nesting).
- **`components/SettingsPanel.js`** — Added `PHOTO_BLUR_MAX`, exported `DEFAULT_PHOTO_ADJUST` and `applyPhotoAdjustments(bg, adjust)` (pure interpolation, photo/custom only). Inside the panel: `photoAdjust` state loaded from storage, a `makeSlider()` helper with a live numeric readout, `buildPhotoAdjust()` (two sliders + fade toggle) appended under the photo grid in `renderBgSection` and shown only for image backgrounds, plus `previewPhotoAdjust()`/`persistPhotoAdjust()` (preview on `input`, persist on `change`). `selectBg` now applies adjustments on photo change.
- **`meridian.js`** — Imported and applied `applyPhotoAdjustments` in `applyStoredAppearance` (fetches `photoAdjust` alongside theme/background), and added a `storage.onChanged` branch that re-interpolates the CSS vars against the current background without re-sampling.
- Mirrored every change into `meridian-extension/` (packaged parity).

### Verification
- Full suite green: **126/126** (`node --test`), including `packagedParity` and `cssSeparation` (no direct `.style.x =` / embedded CSS; only `setProperty`).
- Real Chrome headless render harness across 5 states confirmed: photo full (sharp wallpaper under sharp content), transparency fades toward accent, blur affects only the wallpaper with clean edges, black/white fallback fade, and gradient background rendering fully sharp/opaque (modifiers correctly inert).