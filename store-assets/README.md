# Store Assets

Marketing graphics for the Chrome Web Store listing. These are **not** part of
the shipped extension package — they are uploaded in the Web Store developer
dashboard.

## Small promotional tile — 440 × 280

| | Path |
|---|---|
| **Final export** | `store-assets/promo-tile-440x280.png` (440×280 PNG, RGB) |
| **Editable source** | `store-assets/src/promo-tile-440x280.html` |

### Design

- **Background** — Meridian's signature *Ocean* gradient
  (`linear-gradient(135deg,#0f2027,#203a43,#2c5364)`, the default background /
  accent source in `components/SettingsPanel.js`), with a soft teal glow and a
  faint abstract "workspace lanes" texture so the tile reads as branded art,
  not a raw screenshot.
- **Mark** — the ring + calligraphic flame strokes from `img/Meridian.svg`,
  strokes in `#f5f5f7`, ring in the teal accent (`hsl(197 100% 55%)`,
  from `meridian.css --accent`).
- **Type** — `system-ui` stack (matches `meridian.css`). Wordmark "Meridian"
  plus the product's own tagline, "Spatial tab command center". Text is kept
  minimal: no rankings, awards, performance claims, browser endorsement, or
  simulated UI.

### Regenerate the PNG from the source

Rendered with Chrome headless at native resolution (no external image
dependencies required):

```bash
chrome --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=440,280 \
  --screenshot=promo-tile-440x280.png \
  src/promo-tile-440x280.html
```

Verified at native (440×280) and half (220×140) size for clipping, contrast,
and legibility.
