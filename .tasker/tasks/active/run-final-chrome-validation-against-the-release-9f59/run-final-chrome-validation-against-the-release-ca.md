## Completed

Updated `RELEASE_VALIDATION.md` and committed it as `a64bcb6` (`Update final release validation record`). The worktree is clean.

- Candidate: Meridian `1.1.0` from source commit `bc08589f9ec0a88450c27cd842b1662b7c1409bc`
- Automated checks: 112/112 Node tests, 52 JavaScript syntax checks, 2 manifest parses, 33 runtime parity pairs, `git diff --check`
- Exact artifact: 47 files; directory/extracted tree SHA-256 `c981864c38d24466312a09a3b61c757fe1e81f1d583f51f3c01558896084a51b`
- Upload ZIP SHA-256: `d6e92c4940900390cfb37130b567a84c38c2fe249156165a63682e82dc0277c7`
- Headed Chrome 150 matrix: passed new-tab modes, direct/provider navigation, omni/scoped search, keyboard selection/Escape, both former popup regressions, Settings, native permission deny/grant/revoke, native grouping and drag-and-drop, thumbnail race discard, 12/12 full thumbnail refresh, actual side panel, Chrome accessibility tree, disclosed network origins, storage persistence, service worker, and console inspection
- Former blockers: both no longer reproduce; scoped transitions settle with `aria-expanded="true"`, and retained-query results do not displace Settings
- Thumbnail race: returning to Meridian before the delayed capture left no stale thumbnail; explicit refresh stored all 12 eligible thumbnails and restored Meridian
- Runtime errors: 0 exceptions, console errors, log errors, or unhandled rejections
- Release decision: **Pass - ready as the release candidate**, subject to owner-only Chrome Web Store privacy/disclosure/upload work documented in the record

Observed limitations are recorded: Chrome owns initial New Tab focus; Chrome 150 default startup did not restore fixture tabs/native groups, while extension settings, revoked permission state, pinned Meridian, and all 12 thumbnails persisted.