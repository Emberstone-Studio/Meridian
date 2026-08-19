Replaced the source-pattern settings suites with behavior-level regressions driven by a shared fake chrome.storage.onChanged emitter. The tests now execute the production storage callbacks, appearance loader, render scheduler, and workspace render function against control/container stubs. Coverage verifies cross-window control and appearance sync, real all-windows/current-window chrome.tabs.query arguments plus rerenders, custom-image upload/delete invalidation in open settings and Meridian windows, and latest-wins theme/background async ordering.

Validation:
- Focused corrected-runtime tests: 4/4 pass
- Same tests on pre-fix parent beb506b: 4/4 fail for the expected missing behaviors
- Complete suite: 155/155 pass
- Runtime JavaScript syntax checks: pass
- Manifest parsing: pass
- Packaged runtime parity: pass via the complete suite
- git diff --check: pass