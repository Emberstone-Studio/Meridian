Implemented the missing Settings > Privacy & Data spacing. Added an explicit 28px top margin for `.settings-section.settings-privacy-section` in both `meridian.css` and `meridian-extension/meridian.css`, matching the standard section spacing while overriding the unintended `:first-of-type` rule.

Validation:
- `node --test tests/*.test.mjs` — 145 tests passed
- `git diff --check` — passed
- Confirmed source/package stylesheet parity with `cmp`