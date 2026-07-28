<!-- [task-doc-auto:prepare-chrome-web-store-privacy-disclosures-and-0fe7] -->
# Prepare Chrome Web Store privacy policy and publisher disclosures
_Auto-recorded on completion (2026-07-27T00:05:52.381Z)._

# Chrome Web Store privacy disclosures & publisher copy — rework complete

This was a **rework pass** on prior work in `PRIVACY.md` and `STORE_LISTING.md` (the Chrome Web Store Limited Use statement, permission justifications, and disclosure copy already existed). The reviewer flagged three accuracy gaps against the actual runtime; this pass fixes all three and re-verifies the rest of the acceptance criteria.

## Reviewer feedback addressed

1. **Thumbnail cache limits were described as a strict cap.** Read `utils/thumbnailCache.js`: pruning only ever removes entries for tabs that are *no longer open* (`entry.live` check). If every cached thumbnail belongs to a currently-open tab, nothing is evicted even past ~200 entries / ~50 MB — confirmed by the existing test `live thumbnails remain deterministic soft-cap entries under entry pressure`. Both docs now describe this as a **soft target that live (open-tab) thumbnails are exempt from**, not a hard cap, in: the Screenshots/thumbnails data-table row, the `unlimitedStorage` permission justification, and the reconciliation notes (both files).

2. **`chrome.storage.sync` was implied to stay on one device.** `STORE_LISTING.md` §3's intro said data is processed "entirely on your device"; the Local & sync storage bullet now explicitly states that if the user has Chrome Sync on, preference data syncs through the user's own Google/Chrome account to their other signed-in devices (not Meridian-operated syncing). PRIVACY.md's preferences row already had this caveat and needed no change. Swept the whole repo for `entirely on your device` / `single device` / `never leaves` phrasing — only the one instance existed and is now fixed.

3. **Automatic capture has no restricted-URL filter.** Read `background.js`: `handleActivatedCapture` and `handleUpdatedCapture` (the automatic paths, triggered on tab activation / page load) call `captureTab` → `chrome.tabs.captureVisibleTab` with **no URL check**. Only `refreshAllThumbnails` (the user-requested full refresh) explicitly filters `chrome://`, `chrome-extension://`, and `about:` before switching tabs. I chose **disclosure over a code change**: this task is documentation-scoped, and privileged pages are already excluded from automatic capture by Chrome's own `captureVisibleTab`/`scripting` API restrictions (verified against the existing try/catch handling in `captureTab`), so no user-visible risk exists — the gap was purely that the docs implied Meridian itself filters. Both docs now state plainly that automatic capture/extraction do not filter by URL in Meridian's code, that Chrome's own APIs reject privileged pages, and that only the full refresh has an explicit in-code skip list. **Flagging this as a product decision for the owner to consider**: if reviewers expect an explicit allowlist/denylist in code (belt-and-suspenders beyond relying on Chrome's API behavior), that would be a follow-up code task, not a docs task.

## Also fixed while reconciling runtime vs. copy
- `STORE_LISTING.md`'s reconciliation notes cited `captureVisibleTab` **quality 60**; the actual value in `background.js` is **quality 72**. Corrected.

## Files changed
- `PRIVACY.md` — screenshots/thumbnails table row, `unlimitedStorage`/`<all_urls>` permission bullets.
- `STORE_LISTING.md` — §3 data-handling intro + Screenshots/Local & sync storage bullets, `unlimitedStorage`/`<all_urls>` justifications (§4), reconciliation notes (§6).
- No changes needed to `README.md` or `manifest.json` — re-checked against the new wording; both were already consistent (README already links to PRIVACY.md/STORE_LISTING.md and makes no cap or single-device claims; manifests unchanged, root and `meridian-extension/` still identical).
- No runtime code changed — this is a docs-only fix, consistent with the task's scope.

## Verification
- `node --test tests/*.test.mjs` → **112/112 pass**, including the thumbnail-cache soft-cap/live-protection tests that back the new PRIVACY.md/STORE_LISTING.md wording.
- `node -e "JSON.parse(...)"` on both manifests → valid.
- `git diff --check` → clean (no whitespace errors).
- Grepped the repo for `entirely on your device`, `single device`, `never leaves`, `capped at 200`, `LRU eviction` post-edit → no stale claims remain.

## Owner-only follow-ups — explicitly NOT done (unchanged from prior pass)
Still marked **[OWNER-ONLY — NOT DONE]** in `STORE_LISTING.md` §5, because they require the publisher's Chrome Web Store dashboard, hosting, and operational access that this repository-scoped pass cannot perform:
- Publishing `PRIVACY.md` at a public HTTPS URL and entering it in the dashboard.
- Submitting the single-purpose description, data-type selections, and data-use certifications in the dashboard.
- Confirming each permission justification against the exact uploaded archive.
- Verifying prominent-disclosure/affirmative-consent requirements are met in the live listing and in-product UX.
- A manual network audit of the packed release archive.
- Reviewing current third-party (Picsum, search-provider icon, Chrome favicon) policy terms.
- Reconciling support-contact details and operational practice with the store-form answers.

None of these were marked complete.
