Implemented opt-in custom background sync with a device-local override.

- Added a device-only `Use synced background` preference in `chrome.storage.local`, defaulting off so existing devices continue using their local full-resolution image.
- Added `Sync current background`, which creates an aggressively compressed WebP and iteratively keeps it below a 7,000-character payload budget before writing it to `chrome.storage.sync`.
- Kept the original full-resolution upload in local storage.
- Applied appearance updates when either the shared image or local override changes; an off override always resolves to the device-local image.
- Added tests for quota-bounded compression and local/synced precedence.

Validation: `node --test tests/*.test.mjs` (8 passing), JavaScript syntax checks, and `git diff --check`.