## Summary

Added a minimal donationware credit footer � "Developed by Emberstone Studio" � to the bottom of the Settings panel, directly above the Privacy & Data accordion. It shows the Emberstone brand mark, a short credit line, and two outbound links (studio site + Ko-fi), with no product-lineup list and no in-extension payment flow, as scoped.

## Changes

**components/SettingsPanel.js** (and identical mirror `meridian-extension/components/SettingsPanel.js`)
- New `emberstoneFooter` block appended between `tabsSection` and `privacySection`, so Privacy & Data remains last and the credit sits just above it.
- Logo: `<img src="img/emberstone.svg">` (root-relative, matching `img/aurora.webp`/icon references). Decorative � `alt=""` + `aria-hidden="true"` since the visible credit line already names the studio � with an `onerror` handler that hides a broken-image glyph (same pattern as the provider icons).
- Two links as native `<a href target="_blank" rel="noopener noreferrer">` � the same safe outbound pattern as the existing privacy-policy link � styled with `.settings-action-btn`:
  - "See more from Emberstone Studio" ? https://emberstone-studio.com
  - "Buy us a coffee" ? https://ko-fi.com/emberstonestudio
- Static markup only: no `chrome.*` calls, no click tracking/analytics, no network activity until the user clicks a link.

**meridian.css** (and mirror `meridian-extension/meridian.css`)
- Added `.settings-emberstone*` styles: centered logo/credit, full-width stacked link buttons reusing `.settings-action-btn`, centered labels, and a visible `:focus-visible` ring for keyboard users. The panel already hides its scrollbar (`scrollbar-width: none`), so no scrollbar regression is introduced. Theme-adaptive via existing `--text-secondary`/`--surface`/`--border`/`--accent` vars (works in light and dark).

**img/emberstone.svg + img/emberstone.png** copied into `meridian-extension/img/` so the packaged extension resolves the asset (no console error for a missing path).

**PRIVACY.md** � new bullet under "Remaining network behavior" noting the two Settings outbound links are inert until an explicit click, with no background request and no click tracking/analytics.

**STORE_LISTING.md** � matching bullet in the �3 paste-ready disclosure block (kept adjacent to the "No telemetry or backend" claim) and a reconciliation note in �6, keeping both docs internally consistent. No new permissions or host permissions were added, so the "no telemetry, no backend" claims are preserved.

## Tests
- New `tests/settingsEmberstoneFooter.test.mjs` (follows the `settingsPrivacyDisclosure.test.mjs` extract-and-fake-DOM pattern): verifies the credit text and logo src/alt, both link hrefs + `target="_blank"` + `rel="noopener noreferrer"` + `.settings-action-btn` styling, DOM placement above the privacy accordion, that the logo asset resolves in both the source and packaged trees, and that the footer is mirrored into the packaged component.
- Updated the placement assertion in `tests/settingsPrivacyDisclosure.test.mjs` for the new `panel.append(...)` order (Privacy still last).

## Verification
- `node --test tests/*.test.mjs`: **130 pass, 1 fail**. The single failure � `asyncLatestWins.test.mjs` "sidebar bookmark and history controls switch the list scope" � is **pre-existing and unrelated**: it extracts blocks from `meridian.js` (untouched here), and I confirmed it fails identically on the clean baseline with all my changes stashed. My new footer tests, the updated privacy test, and the runtime-mirror-parity test (`packagedParity`) all pass.
- `node --check` passes on `components/SettingsPanel.js`, the mirror, `meridian.js`, and `background.js`.
- Both manifests parse as valid JSON.
- `git diff --check`: clean (no whitespace errors).

## Notes
- Descoped-as-requested: no product catalog/lineup, no payment flow, no analytics.
- The pre-existing `asyncLatestWins` failure is outside this task scope; flagging it rather than modifying unrelated code.