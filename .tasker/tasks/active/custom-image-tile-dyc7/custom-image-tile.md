## Custom image tile

Reworked the Settings → Background section so the custom-image dropzone no longer eats a full-width row — it now lives as the first tile of the photo grid.

### What changed

**1. Larger 3×4 grids.** Both background grids (`.settings-bg-combined-grid` and `.settings-bg-photo-grid`) went from `repeat(6, 1fr)` to `repeat(4, 1fr)`. Each already holds 12 items, so both now render as a clean 3 rows × 4 columns, with noticeably larger images and swatches.

**2. Custom-image tile replaces the top-left photo.** The photo grid now emits 11 stock photos (`generateSeeds(11)`) plus a dedicated first tile:
- **Empty state** — a blank `--bg` tile with a dashed border and a centered `+` add button using the same glyph/treatment as the new-tab buttons (`var(--text-secondary)`, 22px, accent on hover). The whole tile is the click-to-upload target *and* the drag-and-drop zone (dragenter/over/leave/drop with a `drag-over` highlight).
- The standalone full-width "Drop an image here or click to upload" button was removed entirely.

**3. Thumbnail + hover-to-remove.** After a custom image is added it is stored and its thumbnail fills the first tile. The tile:
- shows the accent selection ring when custom is the active background,
- is clickable/keyboard-activatable to re-select the custom background,
- reveals a remove control on hover (and on keyboard focus): a `+` rotated 45° into an **X** over a dark wash. Clicking it clears the stored image (`clearCustomBackground()`), and — if custom was the active background — falls back to the default, i.e. "start over" back to the empty add tile.

The stored thumbnail is now resolved on panel load regardless of the active background, so the tile persists across sessions and background switches.

### Files
- `components/SettingsPanel.js` — grid seeds, custom-tile render (empty/filled states), add/drop/remove wiring, load-time thumbnail resolution.
- `utils/customBackground.js` — new exported `clearCustomBackground()` (IndexedDB delete + object-URL revoke + legacy-key cleanup).
- `meridian.css` — 4-column grids; new `.settings-bg-custom*` styles (empty `--bg` tile, add `+`, thumbnail, rotated-plus remove X); removed the obsolete `.settings-bg-upload-btn` rules.
- Mirrored all three into `meridian-extension/` to satisfy packaged-parity.

### Verification
- `node --test tests/*.test.mjs` → 130 pass, 1 fail. The single failure (`asyncLatestWins` sidebar bookmarks/history scope) is pre-existing and unrelated — it fails identically on the untouched baseline.
- Relevant suites pass: `customBackground`, `packagedParity`, `cssSeparation`, `backgroundLifecycle`, `backgroundRefresh`, `settingsPopupRace`.
- No inline styles added (cssSeparation rules respected); `box-sizing: border-box` is global so the dashed border keeps the tile aligned with its siblings.

No external design/asset dependencies; no `.tasker/tasks` edits.