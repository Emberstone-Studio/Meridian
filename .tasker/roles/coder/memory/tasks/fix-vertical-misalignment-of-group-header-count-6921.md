<!-- [task-doc-auto:fix-vertical-misalignment-of-group-header-count-6921] -->
# Fix vertical misalignment of group header count badge (lane-tab-count)
_Auto-recorded on completion (2026-08-19T18:38:57.852Z)._

Fixed the group-header count alignment in both shipped CSS copies.

- Changed `.lane-header` from box centering to baseline alignment.
- Removed the compensating `translateY(1px)` rules from `.lane-collapse-btn` and `.lane-tab-count`.
- Mirrored the change in `meridian-extension/meridian.css`.

Verification: rendered the real CSS in headless Chrome and visually confirmed the chevron, group dot, title, and count share the intended header alignment; `git diff --check` passes; both CSS copies remain byte-identical.
