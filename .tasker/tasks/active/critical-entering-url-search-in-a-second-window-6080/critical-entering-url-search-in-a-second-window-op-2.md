## Fixed the second-window Meridian tab duplication

Root cause: restoration was guarded only by the old managed tab ID, while multiple callbacks could independently enter `ensureMeridianTab(windowId)`. In a headed Chromium repro, 13 concurrent requests for one non-primary window created 13 distinct pinned Meridian tab IDs.

Changes:
- Coalesced all in-flight Meridian ensure/restore work by window, so every concurrent caller receives the same tab promise.
- Removed the re-entrant URL rollback from `tabs.onUpdated`. A navigated managed tab now continues to the user's destination, is handed off from managed state, and one inactive pinned Meridian replacement is ensured.
- Mirrored the runtime change byte-for-byte in `meridian-extension/background.js`.
- Added regression coverage for 13 concurrent ensure calls, concurrent navigation updates, stale old-tab updates, and replacement-tab updates.

Verification:
- Headed Chromium 151 with multiple real windows and OS-level address-bar input:
  - character-by-character search `hey`: one destination + one Meridian tab;
  - typed URL `https://example.com`: one destination + one Meridian tab;
  - 13 simultaneous restoration requests: all returned the same single tab ID.
- Attached `meridian-second-window-fixed.png`, showing the clean tab strip after the URL test.
- Full suite: 145 passed, 0 failed.
- All tracked JavaScript passed `node --check`.
- Packaged parity, source/package background parity, and `git diff --check` passed.