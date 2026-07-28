## Prevented automatic thumbnail capture from saving under the wrong tab

### Root cause
background.js debounced automatic captures with two GLOBAL records (lastActivation, lastUpdate) and had no guard immediately before captureVisibleTab. Two failures resulted:

1. Meridian activation was silently ignored. The onActivated handler returned early BEFORE recording a new debounce token when the newly active tab was Meridian, so a pending capture for the previous tab was never invalidated — it woke 600ms later and persisted Meridian pixels under the previous tab id.
2. Global debounce state crossed windows. A single global record meant activity in one window overwrote the token for another, cancelling a valid pending capture in a different window.

### Fix (background.js, mirrored to meridian-extension/background.js for packaged parity)
- Final guard in captureTab: immediately before captureVisibleTab it queries {active:true, windowId} and returns without persisting when the active tab is missing or its id no longer matches the intended tab id.
- Per-window generation state: replaced the two globals with a captureGenerations Map keyed by windowId plus a nextCaptureGeneration(windowId) helper. Each capture path snapshots its generation before sleeping and proceeds only if the window generation is unchanged, so activity in one window cannot cancel valid work in another.
- Every activation invalidates, including Meridian: handleActivatedCapture now bumps the window generation for ALL activations (the Meridian early-return happens after the bump), so switching to Meridian supersedes any pending capture for the previous tab in that window.
- Extracted the listener bodies into named handleActivatedCapture / handleUpdatedCapture functions (registered via addListener) so the logic is unit-testable, matching the repo extract-and-run test pattern.

### Regression tests (tests/thumbnailCaptureRace.test.mjs, 7 tests)
- tab A -> Meridian: A pending capture is discarded.
- tab A completes -> tab B: each is captured under its own id.
- cross-window activation: window B activity does not cancel window A valid capture.
- completed navigation superseded by a newer activation is discarded.
- captureTab persists only on active-tab match; skips on mismatch (Meridian took over) and skips when the window has no active tab.

### Verification
- node --test tests/*.test.mjs  ->  89 passed, 0 failed.
- node --check on every non-node_modules .js file  ->  all OK.
- git diff --check clean; packaged copy kept byte-for-byte in parity (packagedParity test passes).