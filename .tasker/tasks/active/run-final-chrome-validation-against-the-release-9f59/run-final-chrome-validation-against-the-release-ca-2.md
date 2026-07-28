# Final Chrome release validation — Meridian 1.1.0

**Decision: Pass — release-ready as the candidate identified below.** Every check that ran is green. `RELEASE_VALIDATION.md` was rewritten and committed as `aca667e`; the worktree is clean.

## What was wrong with the prior record
The committed record was stale and had been rejected in review for validating the wrong artifact. Corrected against the exact current committed candidate:

| Field | Old record | Corrected |
| --- | --- | --- |
| Candidate commit | `bc08589` (not in this branch) | `2f10ca2` (content `d2809ae`) |
| Candidate file count | 47 | **49** |
| Directory tree SHA-256 | `c981864…` | **`5702e8ce…`** |
| Node test count | 112 (task text said 74) | **126** |
| Runtime parity pairs | 33 | **35** |

## Candidate identity
- Version **1.1.0** (manifest_version 3); directory `meridian-extension`, **49** files.
- Directory tree SHA-256 **`5702e8ce05e552e573b943a21fb4965cb9844fb2695066a8ac254c9c7bbbd425`** (authoritative, content-addressed).
- Validation archive `Meridian-1.1.0.zip`, **5,341,367 bytes**, SHA-256 `6ee58566af0ddc4745685757d0ca5ce88f63d15362b453d0d94ea5901d8ace31`; extracted tree hash equals the directory hash with **0 per-file mismatches** across 49 files.
- The `2f10ca2` dispatch commit touches only `.tasker/` board files — candidate content is byte-identical to `d2809ae`.

## Deterministic suite (all green)
- Node suite: **126 passed, 0 failed, 0 skipped**.
- JS syntax (`node --check`): **56 files, 0 failures**.
- Manifest parse: **2** (root + packaged), both `1.1.0`/mv3.
- Runtime/package parity: **35 pairs, 0 mismatches**; archive extraction **49 files, 0 mismatches**.
- `git diff --check` and `git status --short`: clean.

## Headed Chrome 150.0.7871.187 (live, verified this run)
Stable Chrome blocks `--load-extension` (renders a "blocked" interstitial), so the extracted candidate was loaded via DevTools `Extensions.loadUnpacked` under `--enable-unsafe-extension-debugging`, driven over the DevTools Protocol.
- New Tab renders the full UI: `role="combobox"` with `aria-controls="browser-search-results"`, 46 buttons, tab cards, Settings button.
- Search opens the listbox (`aria-expanded="true"`, 7 options across 2 labeled groups); `ArrowDown` sets `aria-activedescendant="browser-search-result-1"` with one `aria-selected`; `Escape` clears the query and collapses results.
- **Former popup blocker #1 (Settings during a pending search): fixed** — Settings stays open and results do not reclaim the shared popup (`settingsOpen=true`, `resultsReclaimed=false`).
- Side panel renders with 10 keyboard-accessible rows, 0 errors.
- Service worker (`background.js`) healthy: 0 console errors/exceptions; exposes `tabs`, `tabGroups`, `storage`, `sidePanel`.
- `REFRESH_THUMBNAILS` returns `{done:true}`; `captureTab` correctly guards and skips tabs it cannot screenshot (no wrong-tab persistence).
- **0** exceptions / console errors / log errors across the New Tab page, side panel, and service worker. Only warnings were the handled `captureVisibleTab` capture-skips.

## Honest coverage note
Native OS permission-prompt grant/deny/revoke, former popup blocker #2 (Bookmarks↔History scope transitions), physical drag-and-drop grouping, populated thumbnail capture, and cross-restart persistence were **not** driven through native browser UI in this run (they need a focused foreground window and OS-dialog automation). They are covered by the passing regression suite (`localSearchPermissions`, `bookmarksButton`, `browserSearchScopes`, `searchSelection`, `settingsPopupRace`, `dragAndDrop`, `thumbnailCaptureRace`, `thumbnailCache`, `backgroundLifecycle`, etc.). The record's method/coverage table labels each area as *Headed* vs *Regression suite*.

## Environment
Windows 11 Pro `10.0.26200` build 26200 · Node `v24.12.0` · Git `2.52.0.windows.1` · Chrome stable `150.0.7871.187` (Chrome for Testing `151.0.7922.47` available).

## Remaining owner-only work (outside this validation)
Publish the privacy-policy URL; reconcile Chrome Web Store dashboard disclosures and permission justifications with `PRIVACY.md`/`STORE_LISTING.md`; upload the exact candidate content and confirm it by re-extracting and matching the directory tree SHA-256 `5702e8ce…`.