<!-- [task-doc-auto:publish-meridian-v1-2-0-release-package-to-githu-44e0] -->
# Publish Meridian v1.2.0 release package to GitHub
_Auto-recorded on completion (2026-08-14T17:01:47.766Z)._

## Meridian v1.2.0 published

- Release: https://github.com/Emberstone-Studio/Meridian/releases/tag/v1.2.0
- Annotated tag: `v1.2.0` → `7a2028c582b220de2ab5cbef0aa8f42a813de46d`
- Asset: `Meridian-v1.2.0.zip` (5,565,865 bytes)
- ZIP SHA-256: `f737958f6a64a8292afa5dd4af0ff8286cab0400ac028898048eb10773572478`
- Packaged file count: 53
- Extracted directory tree SHA-256: `e25a3c668b4124c3823d2cbb5694bd7afc928bd610949aa9da91ab5ff5d26c9e`
- Documented hash match: **Yes**
- Hosted asset verification: downloaded from GitHub after publication; 53 files and the same extracted tree hash

## Automated checks

- Full Node suite: **131 passed, 0 failed, 0 skipped**
- JavaScript syntax: **56 files checked, 0 failures**
- Manifests: **2 parsed**, both version `1.2.0`, manifest version 3
- Packaged parity: **1 passed, 0 failed**
- `git diff --check`: clean
- `git status --short`: clean

The Linux Tasker checkout contained mixed line endings, while the validated hash records the Windows CRLF checkout form. The release was staged with the validated checkout normalization; the staged tree, locally extracted archive, and re-downloaded GitHub asset all matched the authoritative documented hash. The Tasker-generated dispatch-baseline commit was excluded from the tag; the tag targets the task's explicitly identified release commit `7a2028c`, whose manifest and packaged extension have no content diff from validated candidate `5674a8b`.
