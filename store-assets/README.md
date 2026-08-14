# Store Assets

Marketing graphics for the Chrome Web Store listing. These are **not** part of
the shipped extension package — they are uploaded in the Web Store developer
dashboard.

| Asset | Size | Source | Export |
|---|---|---|---|
| Small promotional tile | 440 × 280 | `src/promo-tile-440x280.html` | `promo-tile-440x280.png` |
| Marquee promotional tile | 1400 × 560 | `src/marquee-1400x560.html` | `marquee-1400x560.png` |

Screenshots (1280 × 800) are captured from the running extension, not generated
here.

## Design

Both tiles follow `img/metro.html`, the brand specimen. Deliberately flat brand
art — no wallpaper photo behind either one.

- **Ground** — `#1c1c1e`, the app's own dark surface token, so the tiles sit in
  the same family as the product rather than inventing a marketing palette.
- **Mark** — the disc with the M knocked out. On a dark ground the counter is a
  true hole and the mint disc reads 9.37:1. Both use `viewBox="12 12 104 104"`,
  tight to the disc: the full `0 0 128 128` frame carries 9.4% transparent
  padding per side, and since flex sizes the box rather than the ink, that
  padding would silently widen the gap next to the mark.
- **Type** — Rubik 500, always caps, `.14em` tracking, with
  `margin-right: -.14em` to cancel the space `letter-spacing` appends after the
  final letter. The wordmark is `#f5f5f7`; the tagline is `--muted` `#98989d`.
- **Color** — `#2ed8b0` as fill only, never as text or a hairline.
- **Marquee right panel** — the lane spine, abstracted to colored spines and
  blank cards with no text. It shows the product's spatial idea without being a
  simulated screenshot. Brand mint is the Ungrouped lane; grouped lanes keep
  their own Chrome tab-group color, exactly as the app behaves.

Text is minimal and factual: no rankings, awards, performance claims, browser
endorsement, or simulated UI. Full bleed, square corners, no transparent edges.

## Regenerate

Chrome headless at native resolution, then flattened to 24-bit RGB. **The store
requires no alpha channel**, and a screenshot straight out of Chrome carries
one, so the flatten step is not optional.

```bash
cd store-assets/src

for spec in "promo-tile-440x280 440 280" "marquee-1400x560 1400 560"; do
  set -- $spec
  google-chrome --headless --disable-gpu --disable-lcd-text --hide-scrollbars \
    --force-device-scale-factor=1 --virtual-time-budget=6000 \
    --default-background-color=1c1c1eff --window-size=$2,$3 \
    --screenshot=/tmp/$1.png "file://$PWD/$1.html"
done

python3 -c "
from PIL import Image
for name in ('promo-tile-440x280','marquee-1400x560'):
    im = Image.open(f'/tmp/{name}.png').convert('RGBA')
    bg = Image.new('RGB', im.size, (28,28,30))
    bg.paste(im, mask=im.getchannel('A'))
    bg.save(f'../{name}.png')
"
```

Two flags are load-bearing. `--disable-lcd-text` forces grayscale
antialiasing; without it Chrome uses subpixel rendering and the wordmark
exports with red/blue color fringing on every stem. `--virtual-time-budget`
gives the webfont time to load — the sources use `font-display: block` so a
slow font can never export as a fallback sans.

If a wordmark renders in a generic sans, the `@font-face` path is wrong. The
sources reach the repo root with `../../fonts/`, and a miss is silent: the
fallback is simply kept, with no console error and no visual warning.
