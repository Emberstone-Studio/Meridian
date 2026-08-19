<!-- [task-doc-auto:switch-app-background-to-topo-light-topo-dark-sy-0283] -->
# Switch app background to topo-light/topo-dark, sync with system theme
_Auto-recorded on completion (2026-08-19T18:07:31.520Z)._

## Completed

- Replaced the shipped default with theme-aware topo wallpaper: `img/topo-light.webp` in light mode and `img/topo-dark.webp` in dark mode.
- Kept the existing default theme as `System`; CSS media-query resolution switches the wallpaper automatically with OS theme changes, while explicit Light and Dark selections override it.
- Forced the shipped wallpaper to full opacity and zero blur, including when stale photo-adjustment values exist.
- Mirrored both WebP assets and runtime changes into `meridian-extension/`.
- Added focused regression coverage for theme resolution, neutral photo effects, and packaged assets.

## Verification

- `node --test tests/*.test.mjs` — 135 tests passed.
- `git diff --check` — clean.
- Runtime source, packaged runtime, and tests contain no `train.webp` references.
- Source and packaged topo assets are byte-identical valid WebP files.
