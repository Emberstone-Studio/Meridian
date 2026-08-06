<!-- [task-doc-auto:re-verify-candidate-hash-after-manifest-version-e85c] -->
# Re-verify candidate hash after manifest version bump to 1.2.0
_Auto-recorded on completion (2026-08-06T15:07:45.824Z)._

# Release validation follow-up complete

**Status: Pass.**

Updated `docs/release-validation.md` with the 1.2.0 candidate identity while retaining the prior full headed-Chrome findings and coverage matrix. The record now explicitly states that this is a version-bump-only follow-up layered on the prior full validation, so no headed Chrome pass was repeated.

## Delta verification

- `manifest.json` and `meridian-extension/manifest.json` both parse as version **1.2.0** / `manifest_version` 3 and are byte-identical.
- The scoped diff from prior validated commit `970421f7eaf3a319e4696c23ac5714535617e6cc` to candidate commit `5674a8bcd4d457ee97ebf479264e9695809ae114` changes only the `version` field from `1.1.0` to `1.2.0` in the two manifests.
- Within `meridian-extension/`, `manifest.json` is the only changed file from the prior candidate.
- The final candidate directory has no uncommitted changes; only `docs/release-validation.md` is modified in the worktree.

## Automated validation

- Full Node suite: **131 passed, 0 failed, 0 skipped**.
- JavaScript syntax: **56 files checked, 0 failures**.
- Manifest JSON parsing: **2 parsed**, both version 1.2.0 / MV3.
- Packaged parity: **35 runtime file pairs matched, 0 mismatches**.
- `tests/packagedParity.test.mjs`: **1 passed, 0 failed**.
- `git diff --check`: clean.
- Existing `MODULE_TYPELESS_PACKAGE_JSON` performance warnings were unchanged and did not affect results.

## Candidate identity

- File count: **53**
- Candidate tree SHA-256: `e25a3c668b4124c3823d2cbb5694bd7afc928bd610949aa9da91ab5ff5d26c9e`
- Reconstructed 1.1.0 control hash: `0046de021282d5ce5382116c351d82854e2a8caa4f6620d13bfbd3460306af78` (matches the prior validation record)

## Archive identity

- Archive: `Meridian-1.2.0-069a7ea52b1640d69da3843ce1ffbc0e.zip`
- Size: **5,569,295 bytes**
- Archive SHA-256: `f7c0b4be744550c6dfec12c1c17babfef613b022b5759521cf8a58f126ce788e`
- Extracted tree SHA-256: `e25a3c668b4124c3823d2cbb5694bd7afc928bd610949aa9da91ab5ff5d26c9e`
- Per-file archive parity: **53 matched, 0 mismatches**
