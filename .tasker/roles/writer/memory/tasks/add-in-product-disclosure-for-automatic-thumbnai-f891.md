<!-- [task-doc-auto:add-in-product-disclosure-for-automatic-thumbnai-f891] -->
# Add in-product disclosure for automatic thumbnails and metadata indexing
_Auto-recorded on completion (2026-07-27T00:12:44.027Z)._

Implemented the requested Settings placement change in both source and the running `meridian-extension/` mirror.

- Moved Privacy & Data after Appearance, Search, and Tabs so it is the final Settings section.
- Replaced the always-visible section with a native collapsed `<details>` / `<summary>` control.
- Added expansion-chevron and keyboard focus styling.
- Kept the complete disclosure and policy link inside the expandable content.
- Updated regression coverage for native semantics, collapsed default, and bottom placement.
- Validation: all 113 Node tests pass; source/package parity and JavaScript syntax checks pass.

Final approval still requires the published privacy-policy URL to return successfully.
