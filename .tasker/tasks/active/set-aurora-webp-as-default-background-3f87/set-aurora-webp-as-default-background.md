## Set aurora.webp as default background — complete

`img/aurora.webp` is now the default background when the user hasn't chosen one.

### Changes
1. **`components/SettingsPanel.js`** (~line 118) — `DEFAULT_BACKGROUND` changed from the Ocean gradient to `{ type: "photo", value: "img/aurora.webp" }`. Updated the now-stale comment that referenced the Ocean-gradient swatch.
2. **`meridian-extension/components/SettingsPanel.js`** — same mirrored change.
3. **`meridian-extension/img/aurora.webp`** — copied the asset in (byte-identical, sha256 `8b9d17c4…`). The extension ships its own `img/` folder and previously lacked `aurora.webp`; without this the mirrored default would have resolved to a missing file and rendered a blank background. This makes the mirror functional rather than being new-asset design work.

### Verification
- **`applyBackground()`** — the `bg.type === "photo"` branch sets `--bg-image: url("img/aurora.webp")`, resolved relative to `meridian.html` (repo root for the web app, extension root for the extension). Both locations now contain the asset. ✓
- **`analyzeBackground()` / `analyzeImage()`** — the photo is loaded **same-origin** (relative path), so the `crossOrigin="anonymous"` canvas sampling is not tainted and `getImageData()` succeeds. If loading ever fails, `onerror`/`catch` return `{dominant:null, lum:null}`, degrading gracefully to the theme's default accent and live `--bg` on-background text. No canvas-tainting issue. ✓
- **`applyAccentFromBackground()` / `applyDerivedAccent()` / `applyOnBackground()`** — theme-aware via `docIsDark()`; the contrast solver adapts its lightness floor/ceil/step per theme, and on-background text is chosen from the sampled luminance. Produces sane accent + contrast under both light and dark `prefers-color-scheme`. ✓
- **CSS (`meridian.css` line 67, mirrored in the extension)** — `background-image: var(--bg-image, none)` lives on `body`, outside every `prefers-color-scheme` / `[data-theme]` block. Only `--bg`/`--surface` change by theme; `--bg-image` is theme-agnostic, so no theme-specific CSS changes were needed. ✓
- **Syntax** — `node --check` passes on both edited files.

No further visual QA needed (user already validated the image). Task status left unchanged for the server to manage.