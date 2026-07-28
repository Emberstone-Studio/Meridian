## Completed

Added `.github/workflows/release-checks.yml` with a Node.js 24 GitHub Actions job that runs on pushes, pull requests, and manual dispatch. It runs the complete `node --test tests/*.test.mjs` suite (including the packaged runtime parity invariant), checks every tracked runtime JavaScript file with `node --check`, parses both extension manifests, and runs `git diff --check`. Syntax and manifest failures emit file-specific GitHub error annotations.

Added a `Release checks` section to `README.md` documenting the matching local PowerShell commands and explaining the packaged parity coverage. No build system or third-party runtime dependency was added.

Validation completed successfully:

- Node.js `v24.12.0`
- 90 tests passed, 0 failed
- 50 JavaScript files passed `node --check`
- Both manifests parsed successfully
- `git diff --check` passed
- Final trailing-whitespace and diff review passed