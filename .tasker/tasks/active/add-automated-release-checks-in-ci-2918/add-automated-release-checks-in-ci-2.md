## Completed

Updated `.github/workflows/release-checks.yml` so the Node.js 24 release-check job preserves the test, JavaScript syntax, manifest parsing, and runtime mirror parity checks while validating committed whitespace over meaningful Git ranges:

- pull requests: base merge-base through pull-request head
- ordinary pushes: event `before` through `after`
- new branches: default-branch merge-base through pushed head
- manual dispatch: the latest commit
- branch deletion: explicitly skipped because it adds no content

Checkout now fetches full history so all referenced commits are available. Failures retain command output and file-specific GitHub annotations for clear diagnostics.

Updated `README.md` with matching working-tree, staged, and committed-branch local commands and corrected `meridian-extension/` terminology to describe it as the runtime mirror.

Validation completed successfully:

- Node.js `v24.12.0`
- 112 tests passed, 0 failed, including runtime mirror parity
- 52 tracked JavaScript files passed `node --check`
- both manifests parsed successfully
- PR, ordinary push, new-branch, and manual-dispatch `git diff --check` ranges passed
- working-tree, staged, and `main...HEAD` whitespace checks passed
- final diff contains only `.github/workflows/release-checks.yml` and `README.md`

No build system or third-party runtime dependency was added.