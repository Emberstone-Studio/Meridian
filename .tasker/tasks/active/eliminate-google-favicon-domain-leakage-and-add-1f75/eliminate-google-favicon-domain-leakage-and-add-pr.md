Implemented the favicon privacy fix and repository disclosures.

- Replaced the sidebar's Google S2 fallback in both shipped trees with a shared Chrome `/_favicon/` helper.
- Routed sidebar tabs, bookmark/history rows, and search result favicon construction through the packaged endpoint.
- Added a generated letter-tile fallback for missing URLs and failed favicon loads, with no third-party fallback request.
- Added `PRIVACY.md` covering tabs, bookmarks, history, locally extracted page metadata, screenshots/thumbnails, local and sync storage, custom backgrounds, permissions, remaining network behavior, retention, and an explicitly unverified Chrome Web Store disclosure checklist.
- Linked the privacy policy from the README.
- Added regression tests for tab, bookmark, and history favicon URLs, missing favicons, failed loads, and both shipped sidebar copies.

Validation:

- `node --test`: 21/21 passing.
- Repository-wide literal scan: no `google.com/s2/favicons` reference.
- `git diff --check`: passing.
- Root and `meridian-extension` copies of all affected shipped files are byte-identical.