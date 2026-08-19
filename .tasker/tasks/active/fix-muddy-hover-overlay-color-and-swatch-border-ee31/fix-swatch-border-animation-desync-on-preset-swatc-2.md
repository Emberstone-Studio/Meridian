Implemented the preset swatch geometry fix.

- Removed the redundant full-size child swatch from preset tiles. The preset wrapper now directly owns the background/image, clipping, hover transform, transition, and selected ring—the same single-box structure used by the custom-photo tile.
- Preserved mouse and keyboard activation, and stopped the selected remove control from bubbling into preset selection.
- Mirrored the implementation and CSS in `meridian-extension/`.
- Left the hover overlay darkening color unchanged.
- Expanded regression coverage to pin the single-box DOM structure, keyboard behavior, remove-event isolation, and shared transition contract.

Verification:

- `node --test tests/*.test.mjs` — 145/145 passing.
- Source/package component and stylesheet parity checks pass.
- `git diff --check` passes.
- Headed Chromium computed-style check: custom and preset both reach `scale(1.05)` from the same centered transform origin, use `box-shadow, transform` at `0.15s` / `ease`, and render one 2 px selection ring on the transformed visual element.

Fresh hover comparison (custom photo reference left; fixed preset color right):

![Custom photo and fixed preset color hover comparison](/tmp/swatch-hover-comparison.png)