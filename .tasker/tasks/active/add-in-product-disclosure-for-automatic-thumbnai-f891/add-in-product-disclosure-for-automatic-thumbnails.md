## Summary

Added an always-visible, accessible "Privacy & Data" disclosure to Meridian's Settings panel that explains the automatic data handling behind live thumbnails and open-tab search, matching PRIVACY.md's plain-language framing.

## Changes

- **`components/SettingsPanel.js`** (+ synced copy in `meridian-extension/components/SettingsPanel.js`):
  - Added a new `Privacy & Data` section, rendered **first** in the Settings panel (before Appearance/Search/Tabs) so it's visible without any extra click or onboarding flow, and without blocking core workflows (Settings is opt-in UI, not a modal/interstitial).
  - Three plain-language paragraphs:
    1. States that Meridian automatically captures a screenshot of the active tab for live thumbnails, and automatically reads each loaded page's meta description and H1/H2 heading text for local open-tab search — both without a separate prompt.
    2. States the data is stored locally in the Chrome profile, that Meridian has no server and never uploads it, and points to the existing **Local Search** and **Thumbnails** controls below as the relevant feature controls.
    3. Explicitly states bookmark/history access is **never automatic** — Chrome permission is only requested when the user turns on Bookmarks or History under Local Search — preserving the existing optional-permission flow untouched.
  - A real `<a href>` link (`target="_blank" rel="noopener noreferrer"`) reading "Read Meridian's full privacy policy", pointing at the repo's `PRIVACY.md` (exported as `PRIVACY_POLICY_URL` for testability).
  - Uses only semantic `<p>`/`<a>` elements in normal document flow — no `aria-hidden`, no `display:none`, no interactive widget needed — so it's reachable by keyboard Tab order and read by assistive-technology virtual cursors like any other panel text; the link itself is natively focusable.

- **`meridian.css`** (+ synced copy in `meridian-extension/meridian.css`): added `.settings-privacy-group`, `.settings-privacy-text`, and `.settings-privacy-link` rules consistent with existing settings typography, including a `:focus-visible` outline on the link.

- **`tests/settingsPrivacyDisclosure.test.mjs`** (new): 5 tests extracting and rendering the disclosure block against a minimal fake DOM (same technique as `tests/settingsPopupRace.test.mjs`), verifying: thumbnail/metadata wording, local-storage + feature-control wording, that bookmark/history access is described as never-automatic, that the policy link is a real focusable `<a>` with correct `href`/`target`/`rel`, and that the section is registered first in the panel.

## Verification

- `node --test tests/*.test.mjs` → **95/95 passing** (all pre-existing tests plus the 5 new ones), including `packagedParity.test.mjs` (root vs. `meridian-extension` stay byte-identical) and `manifestPermissions.test.mjs`.
- `node --check` passed on all modified/added `.js` files; `meridian.css` brace-balance verified (not JS, so `node --check` doesn't apply to it).
- No changes to `manifest.json` or the optional-permission flow in `utils/localSearch.js` — bookmarks/history remain gated behind the existing `chrome.permissions.request` flow, untouched by this change.