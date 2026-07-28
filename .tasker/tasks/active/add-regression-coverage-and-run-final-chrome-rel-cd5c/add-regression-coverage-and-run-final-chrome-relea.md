## Completed

Added release-package regression coverage, fixed the two stale packaged runtime files it exposed, and completed automated plus unpacked-Chrome validation.

### Changes

- Added `tests/packagedParity.test.mjs`, which compares every runtime entrypoint and every file under `components/` and `utils/` with the shipped `meridian-extension/` copy.
- Synchronized `meridian-extension/components/ContextMenu.js` so moving a tab into a new native group clears its Meridian assignment.
- Synchronized `meridian-extension/components/WorkspaceLane.js` so packaged lane rename correctly handles Enter, Escape, and blur without duplicate commits.
- Added `RELEASE_VALIDATION.md` with exact commands, results, the unpacked Chrome procedure, console observations, cleanup, and Chrome Web Store risks.

The new parity regression was run before the packaged fixes and failed on both stale files. It passes after synchronization.

### Automated validation

- `node --test tests/*.test.mjs` - 41 passed, 0 failed.
- `node --check` across all runtime JavaScript - 40 files passed.
- Third-party favicon fallback scan - no Google S2, DuckDuckGo icon service, FaviconKit, or Clearbit fallback references in shipped runtime files.
- `git diff --check` - passed.

Coverage includes local favicon fallback/privacy, sidebar and accent latest-result wins, lane rename Enter/Escape/blur, native assignment cleanup, disabled local-search API suppression, web-search clearing, homepage validation, sidebar keyboard activation, optional permission denial/removal/revocation, thumbnail refresh, storage serialization, and source/package parity.

### Chrome validation

Loaded `meridian-extension/` through Chrome 150.0.7871.182's normal **Developer mode ? Load unpacked** UI in a fresh temporary profile. Verified startup, local/web search and clearing, settings, theme persistence across reload, HTTPS JPEG thumbnail capture, native grouping and lane rendering, native rename Enter/Escape/blur, native assignment cleanup, `/` and Escape keyboard navigation, sidebar Enter activation, and cleanup of temporary tabs/groups/storage.

Extension-page and side-panel console captures were clean. The service worker had no unhandled exception. It emitted two handled capture warnings when the validation activated privileged Chrome/extension pages, then successfully captured the HTTPS test page and continued normally.

### Remaining Store blockers/risks

No code or automated-test blocker remains. Chrome Web Store submission remains blocked on publisher-side verification that cannot be established from this repository: a reachable matching privacy-policy URL, reconciled Store data-use declarations, permission justifications for `<all_urls>`, `unlimitedStorage`, thumbnails and optional sources, disclosure of provider-icon/Picsum requests, and byte-for-byte audit of the submitted archive. Broad host access and stored visible-page screenshots remain likely review-scrutiny areas; the handled privileged-page capture warnings are not a functional blocker.