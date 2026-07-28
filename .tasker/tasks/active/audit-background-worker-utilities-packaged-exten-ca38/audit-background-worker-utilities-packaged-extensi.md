## Confirmed findings

### High - Pinned Meridian tab does not respawn after a cold service-worker start
- Location: `background.js:4`, `background.js:106-112` (same packaged lines).
- `meridianTabId` is volatile module state. `tabs.onRemoved` compares only that variable and never resolves the persisted ID. When MV3 starts a cold worker for the removal event, the comparison fails and the stored ID/tab are not repaired.
- Runtime proof: closing stored Meridian tab `990283226` after a worker restart left zero pinned Meridian tabs after 1.5s and storage still held `990283226`.
- Fix: in the removal handler compare the removed ID with persisted state when memory is empty, then clear it and schedule/await `ensureMeridianTab()`; add a cold-worker test.
- Follow-up blocker: this core auto-respawn failure should block release until fixed.

### Medium - Thumbnail refresh corrupts previous-tab state
- Location: `background.js:179-204`, `background.js:234-242` (same packaged lines).
- Refresh activates every capturable tab while `isRefreshing`; the capture listener honors that guard, but the listener writing `previousTabId` does not.
- Runtime proof: a known `previousTabId` pointing at `about:blank` changed to the traversed IANA tab after refresh, although the original active Example tab was restored.
- Fix: return early from the previous-tab listener while `isRefreshing` remains true; test preservation of active and previous IDs.

### Medium - Workspace search index is stale after assignment/rename
- Location: `utils/browserSearch.js:98-140` (snapshot at line 138) and `utils/browserSearch.js:179-225` (same packaged lines).
- Workspace names enter the index only on tab create/update/rebuild. Workspace mutations never update the index.
- Runtime proof: after assigning Example to `Migrated Audit Workspace`, its index still contained `workspaceName: ""`; searches for that and renamed `Renamed Workspace` returned no tabs.
- Fix: update/rebuild affected index entries on `chrome.storage.onChanged` for `workspaces`, or join current workspace data during search; test assign/rename.

### Medium - Domain clustering merges unrelated public-suffix sites
- Location: `utils/domainCluster.js:27-33` (same packaged lines).
- Last-two-label parsing maps both `news.bbc.co.uk` and `shop.example.co.uk` to `co.uk`, producing one workspace named `Co`.
- Fix: use a maintained Public Suffix List implementation and cover `co.uk`, `com.au`, and private suffixes.

No style-only nits are included.

## Permission-use verdict
- `scripting` is actively used at `utils/browserSearch.js:150-159` for metadata/headings extraction. Runtime injection on `https://example.com/` returned its title and H1.
- `<all_urls>` authorizes that arbitrary-page injection and unattended `captureVisibleTab` calls at `background.js:70-73`; automatic captures cannot rely on transient `activeTab`.
- Do not remove either permission unless those features are redesigned. Host patterns could be narrowed to supported web schemes, but broad host access is required by current behavior.

## Packaged-source drift
- SHA-256 compared all 36 root/package pairs by relative path, including code, manifests, HTML/CSS, and assets.
- Every pair is byte-identical; there are no missing or packaged-only files and no running/package drift.

## Verification
- `node --test tests/*.test.mjs`, Node `v24.12.0`: 16 passed, 0 failed.
- `node --check` across 34 JavaScript files: 0 failures.
- Unpacked smoke: Chrome for Testing `151.0.7922.47`, isolated profile, loaded from `meridian-extension/`. Installed branded Chrome 150 ignored command-line unpacked loading, so the official testing build was used.
- Startup created one pinned Meridian tab, persisted its ID, and configured action-click side-panel behavior.
- Search returned 2 tab, 1 bookmark, and 2 history results for Example.
- Activation capture produced JPEG data. Refresh returned `{done:true}`, captured both HTTPS tabs, and restored the active tab.
- Legacy custom-background fallback worked; saving a Blob moved data to IndexedDB, returned `blob:`, and removed the legacy key. Workspace v1 normalizes in memory and is replaced by v2 defaults plus the first mutation, matching intentional reset logic.
- Runtime permissions matched the manifest; script and host access both succeeded.
- Direct-gesture `sidePanel.open()` succeeded; sidebar rendered current tabs/group.
- Created, titled, colored, queried, and rendered a two-tab native group.
- No uncaught extension exceptions or extension error-level logs. Handled warnings occurred for empty/about activation capture; later HTTPS captures succeeded. Browser sandbox/network diagnostics were environment-only.
- Main and sidebar UIs visually rendered lanes, thumbnails, grouping, search, and navigation without load failures.

No product files changed; worktree clean.