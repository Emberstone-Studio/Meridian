## Completed

- Restored Transparency and Blur controls for the shipped theme-aware topo background by treating `type: "theme"` as an adjustable image background.
- Applied the fix to both `components/SettingsPanel.js` and the mirrored `meridian-extension/components/SettingsPanel.js`.
- Updated regression coverage to verify neutral defaults remain fully opaque with zero blur, and non-neutral slider values update the live opacity/blur CSS variables.

## Verification

- `node --test tests/themeBackground.test.mjs` — 2 passed.
- `node --test tests/*.test.mjs` — 135 passed.
- `git diff --check` — clean.
- Source and packaged component files remain byte-identical.