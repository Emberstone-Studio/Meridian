<!-- [task-doc-auto:re-run-release-validation-against-current-head-p-6b00] -->
# Re-run release validation against current HEAD (post d2809ae changes)
_Auto-recorded on completion (2026-08-06T13:41:07.843Z)._

# Release validation complete

**Status: Pass.**

Updated `docs/release-validation.md` with a fully regenerated release record for candidate commit `970421f7eaf3a319e4696c23ac5714535617e6cc`.

## Fix

The failing `asyncLatestWins.test.mjs` assertion was stale after `2d626f6` changed sidebar scope chips into pure filters. The test now correctly verifies that Bookmarks and History chip clicks do not request optional permissions. Isolated result: 5 passed, 0 failed.

## Automated validation

- Full Node suite: 131 passed, 0 failed, 0 skipped.
- JavaScript syntax: 56 files checked, 0 failures.
- Both manifests parse as version 1.1.0 / manifest_version 3.
- Source/package parity: 35 pairs matched.
- `git diff --check`: clean.
- Final worktree changes are limited to `docs/release-validation.md` and `tests/asyncLatestWins.test.mjs`; `meridian-extension/` is unchanged.

## Headed Chrome validation

Google Chrome 151.0.7922.76 loaded the unpacked candidate in a fresh profile. The run verified:

- New Tab override and live service worker.
- Aurora default background.
- Transparency/blur live preview and sync-storage persistence.
- Emberstone Studio footer and safe outbound links.
- Privacy link opens exactly `https://emberstone-studio.com/docs/privacy/meridian`.
- History quick-open production component dispatches `chrome://history/`.
- Viewport-capped popup sizing.
- Search grouping, keyboard selection, Escape behavior, and Settings/search race.
- Side-panel rendering and disabled-source chip visibility.
- Thumbnail refresh response `{done:true}`.
- Zero page/side-panel runtime exceptions, console errors, or log errors.

## Candidate identity

- Files: 53.
- Candidate tree SHA-256: `0046de021282d5ce5382116c351d82854e2a8caa4f6620d13bfbd3460306af78`.
- Extracted archive tree SHA-256: same.
- Archive parity: 53 matched, 0 mismatches.
- Archive SHA-256: `0b68d0e6d3ca9c49904880496b922ebee19e48a0a3c6655fdc12d0f69fd12c74`.

## Version guidance

Recommend bumping the manifest to **1.2.0** because the post-validation changes add multiple visible features. If 1.1.0 has already been uploaded or published, a higher version is mandatory. No manifest version was changed in this task; any version edit requires rerunning package identity and parity checks.
