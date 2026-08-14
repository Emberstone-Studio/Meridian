# Rubik + #2ed8b0 brand system — ported

All seven sections landed in both trees. `node --test "tests/*.test.mjs"` → **131/131 pass** (includes `packagedParity`, which enforces the mirror). Mirror verified byte-identical across `meridian.css`, `meridian.html`, `meridian.js`, `background.js`, `manifest.json`, `components/`, `utils/`, `fonts/`.

## What changed

**1 · Rubik bundled.** Fonts moved to `fonts/` (both trees) with `Rubik-OFL.txt` alongside. Both `@font-face` blocks copied verbatim — `font-weight: 300 900`, `woff2-variations`, both `unicode-range`s, **`font-display: optional`** (no `swap` anywhere in live CSS). `--font-ui` added and `meridian.css`'s body stack routed through it.

`sidebar.css` needed **its own copy** of the `@font-face` blocks and tokens — the side panel is a separate document that never loads `meridian.css`, so a token-only edit would have left it unstyled. Its paths are `../fonts/…`.

**2 · Weights.** All 20 weight declarations dropped one step (12× 600→500, 4× 500→400, 4× 700→600). No 700s remain.

**3 · Brand tokens.** `--brand` / `--brand-ink` declared once per stylesheet, so they are structurally fixed across themes — no dark-mode override exists to drift. `--accent` untouched and never aliased.

**4 · Mark.** Mask defined once in `meridian.html`'s SVG defs. The treatment rides on two inherited custom properties (`--mark-mask` / `--mark-counter`) rather than theme-scoped selectors. This **toggles the `mask` property itself** as required, and it lets `.mark--plate` opt back into the knockout by re-declaring the tokens locally — no specificity fight against `html[data-theme="dark"]`, which a plain `.mark--plate` rule would have lost.

**5 · Lockups.** `.lockup-plate`, `.lockup-quiet`, `.wordmark` ported exactly, including `margin-right:-.14em` and the `10px 24px 10px 10px` pill padding. Lockup SVGs use `viewBox="12 12 104 104"`.

**6 · Lane spine.** `WorkspaceLane.js` now wraps the grid in `.lane-body` and sets `--group-color` on `.workspace-lane` (was on the dot). Dot reconciled to the 13px ring.

## Judgment calls you should know about

**Spine offsets re-derived** (the task authorised this). In the reference the dot is the header's first child at x=0..13; here the collapse chevron (20px) + 8px gap precede it, so the dot sits at x=28..41. Verbatim `left:3px` would have put the spine nowhere near the dot.
- `left:32px; width:4px` → spine centre 34.0 vs dot centre 34.5. **0.5px off** — tighter than the reference's own 1.5px.
- `top:-15px` (not −10) — the dot's lower edge lands at 17.5px and `.lane-body` starts 32px down, so 15px is what actually tucks the spine under the dot.
- `padding-left:44px` (not 26). Preserving the reference's absolute 27px spine→card gap would have pushed cards 87px off the viewport edge, since the spine already starts 32px in versus 3px there. Gap tightened to 16px. **Offsets adjusted, concept intact.**

**Dot centre is `transparent`, not `--ground`.** The reference fills it with the flat page color, but this header sits on the *wallpaper* — a plug of `--bg` would read as a mismatched grey disc over a photo. Confirmed in the dark+wallpaper shot: the wallpaper reads cleanly through the ring. Also set `color:var(--group-color)` so the pre-existing `currentColor` hover ring finally picks up the group hue.

**Every lane now renders a dot** — it's the spine's cap, and ungrouped lanes had none. Click-to-recolor stays restricted to real Chrome groups; other lanes get a non-interactive `<i aria-hidden>`, matching the reference's markup.

**Collapse now toggles `.lane-body`, not `.tab-grid`.** Hiding only the grid would have left an orphaned stub of spine under a collapsed lane.

**Tracking — §2 vs §6 conflict.** §2 says "any all-caps text needs .13–.15em"; §6 explicitly specifies `.lane-title` at **.05em**, and metro.html agrees. I read the specific as overriding the general: `.lane-title` keeps .05em, `.wordmark` gets .14em, and the remaining small uppercase labels (`.settings-label`, `.search-results-label`, sidebar `.section-label`) go to .13em. Worth a glance if you meant .13em universally.

## Deferred — needs your call

**Icon PNGs / `favicon.svg` were not regenerated.** The shipped `img/icon-source.svg` is a **different mark entirely** — the spiral wordmark glyph, not the disc+M. Only `img/logo-proposal/icon-source.svg` carries the disc+M. Regenerating from it would swap the logo's geometry, which contradicts the task's "Logo geometry is unchanged." That bullet was also conditional, and the current icon already solves light/dark contrast another way (opaque `#f5f5f7` disc behind dark ink), so the ink-counter variant isn't needed for those surfaces. **The mark redesign looks like an unshipped decision that predates this task** — say the word and I'll port the geometry and regenerate all four PNGs plus the favicon.

## Verification

Rendered the real stylesheet in headless Chrome at 2× across light/dark × wallpaper/none, marks at 16/32/72px.

- **Halo check at 16px on light (the specific risk):** sampled 392 interior pixels and measured each against the ink→mint line. **Max deviation 1.7** — a genuine halo pixel would deviate by **95.1**. The ink meets the mint directly; no page background composited into the stroke.
- **Theme matrix:** light → `mask:none` + counter `rgb(13,47,40)`; dark → `mask:url(#meridian-m)` + counter transparent; `.mark--plate` → knockout in **both**. `--brand`/`--brand-ink` identical across themes.
- **Dark + wallpaper:** wallpaper reads through the M at all three sizes — a true knockout, not a fill.
- **No layout shift:** `document.fonts.ready` width delta **0**, cumulative layout shift **0**. `latin-ext` reports `unloaded` — subsetting works, it only fetches on demand.
- **Geometry probe:** dot 13px @ x=28, spine `left:32px width:4px opacity:.55 top:-15px`, `.lane-body` padding-left 44px, `.lane-title` 13px/500/.05em/uppercase.

## Two bugs I caught mid-flight

Both were silent — flagging them since they shaped the approach:

1. A batch `sed` cascaded (700→600→500→400 in one pass) and flattened **every** weight to 400. Recovered by replaying the pristine `HEAD` blob's values through the mapping, without touching the working tree — no `git checkout`/`restore` was used at any point, per the constraint.
2. The repo is **CRLF** (`sidebar.css` and `WorkspaceLane.js` are mixed CRLF/LF). My first edits normalised `meridian.css` to LF, ballooning the diff to 3,796 lines. Rebuilt byte-exactly; the diff is now 82 lines and all original line endings are preserved. The same mixed-endings trap then silently dropped sidebar's token block — **the entire side panel was rendering in Times New Roman**, caught only by screenshotting it. Fixed with an ending-agnostic match and re-verified visually.
