## Meridian — 440×280 Chrome Web Store promotional tile

Delivered a full-bleed, on-brand small promo tile suitable for the Chrome Web Store "small promotional tile" field.

### Deliverables
| Asset | Path |
|---|---|
| **Final export** | `store-assets/promo-tile-440x280.png` — 440×280 PNG, 8-bit RGB (~80 KB) |
| **Editable source** | `store-assets/src/promo-tile-440x280.html` |
| **Docs** | `store-assets/README.md` — design notes + regeneration command |

Marketing assets live in a new top-level `store-assets/` directory, kept **separate** from the shipped extension (`meridian-extension/`) since Web Store promo art is uploaded via the developer dashboard, not in the package.

### Design
- **Background** — Meridian's signature *Ocean* gradient `linear-gradient(135deg,#0f2027,#203a43,#2c5364)` (the app's default background / accent source in `components/SettingsPanel.js`), with a soft teal glow and a faint abstract "workspace lanes" texture so the tile reads as branded art rather than a raw screenshot.
- **Mark** — the ring + calligraphic flame strokes from `img/Meridian.svg`; strokes in `#f5f5f7`, ring in the teal accent `hsl(197 100% 55%)` (`meridian.css --accent`).
- **Type** — `system-ui` stack (matches `meridian.css`): "Meridian" wordmark, teal accent rule, and the product's own tagline "Spatial tab command center".

### Policy compliance
Text is minimal and factual — **no** rankings, awards, performance claims, browser endorsement, or simulated/misleading UI. Full-bleed with no transparent corners.

### Verification
- File confirmed as exactly **440×280 PNG, RGB** (`file` check).
- Visually inspected at **native 440×280** and **half size 220×140**: wordmark stays crisp and legible, mark reads clearly, tagline remains readable, strong contrast (white/teal on deep teal-slate), and no clipping at any edge.
- Rendered with Chrome headless at native resolution (no external image tooling needed); regeneration command documented in `store-assets/README.md`.