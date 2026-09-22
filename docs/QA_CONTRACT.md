# QA CONTRACT
## Academic Dashboard — Native-Overhaul Branch

---

## Verification Commands

Every agent must be able to run these and understand their outputs:

```sh
bun run typecheck   # tsc --noEmit — zero TypeScript errors required
bun run lint        # oxlint — zero new errors (2 pre-existing warnings are acceptable)
bun run test        # bun test — all tests must pass
bun run verify:ui   # Electron screenshot smoke test
bun run benchmark:ui --stage=<name> --samples=5  # production Electron timing medians
bun run check       # runs typecheck + lint + test in sequence
```

---

## Test Suite (as of Native-Overhaul)

| File | Count | What it covers |
|------|-------|----------------|
| `tests/layout.test.ts` | 12 | Widget layout: legacy docking, coordinate normalization, collision reflow, movement, resize, bounds, SQL persistence |
| `tests/dashboard.test.ts` | 9 | Task priority, summary stats, course management, SQL persistence, workspace service |
| `tests/calendar.test.ts` | 5 | Event validation, weekly recurrence boundaries, local dates, overlap lanes |
| `tests/database.test.ts` | 3 | SQLite atomic save/reload and event persistence across repository restart |
| `tests/academic.test.mjs` | 9 | CSV/JSON import, backup/restore, fibery data, completion recording |
| `tests/internships.test.mjs` | 7 | Internship model, import, timeline, deadlines |
| **Total** | **45** | |

All 45 tests must pass before any change is considered complete.

---

## What Must Be Tested Before Merge

### Code changes to `src/data/`
- Run the full test suite.
- Add or update tests in the relevant test file to cover the new/changed function.
- Pure functions must have unit test coverage before going to production.

### Code changes to `src/platform/`
- Run `bun run typecheck` and `bun run test`.
- Database schema changes: verify a round-trip (save then reload) in `database.test.ts`.

### Code changes to `src/features/` (React components)
- Run `bun run typecheck`, `bun run lint`, `bun run test`.
- Run `bun run verify:ui` and confirm no screenshot errors.
- Visually inspect the screenshot in `artifacts/`.

### Code changes to `src/styles/globals.css`
- Run `bun run verify:ui`.
- Visually inspect the screenshot.
- Test at multiple window widths if layout CSS was changed.

---

## Pre-existing Lint Warnings (Do Not Fix Without Tracking)

These two warnings existed before Native-Overhaul and are pre-existing technical debt:
1. `tests/academic.test.mjs`: `getEntityById` imported but never used.
2. `src/internships/model.ts`: useless spread in `for...of` loop.

Do not add new warnings. Do not fix these without a DECISIONS.md entry (they may affect test coverage if changed).

---

## Regression Checklist

Before ending any session that touches the widget grid, task list, or layout system, manually verify:

- [ ] Tasks appear on the Dashboard.
- [ ] Task completion toggles without error.
- [ ] Adding a task via the "+" button works.
- [ ] The calendar widget renders in month view.
- [ ] Edit layout mode activates and deactivates cleanly.
- [ ] Dragging a widget grip previews snapped movement in both axes and saves one collision-free layout.
- [ ] The southeast handle resizes width and responds to deliberate vertical movement without clipping edit controls.
- [ ] `Alt+Arrow`, resize arrow keys, and `Shift+Up` work and announce their results.
- [ ] Narrow layouts stack without horizontal page overflow or rewriting saved desktop coordinates.
- [ ] No widget has an unexpected scrollbar without Pin being enabled.
- [ ] Reset layout button restores the default layout.

---

## Verification for UI Changes

`bun run verify:ui` does the following:
1. Launches Electron with a temp SQLite database and isolated browser profile.
2. Waits for the React app to mount.
3. Exercises task creation/completion/reordering; one-time event persistence; recurring-series creation/edit/delete; time-cell prefill; month/week/day switching; current-time lines; settings, notes, credits, internships, and widget-layout persistence.
4. Captures representative Dashboard, week-calendar, day-calendar, narrow, layout-edit, and analytics screenshots in `artifacts/` (gitignored).
5. Closes the window and isolated services.

The script is a real Electron interaction smoke test. It performs a CDP pointer drag, keyboard/pointer resize, Pin, persistence, and Reset assertions. The regression checklist still applies to nuanced visual and reduced-motion states.

---

## UI Performance Benchmark

`scripts/benchmark-ui.ts` builds the production renderer and Electron process, launches five isolated temporary profiles/databases, and reports raw samples plus medians. It measures renderer-ready/process-ready startup, first navigation, and warm navigation paths using the same readiness markers for every stage.

For animation changes, capture `pre-animation` and `post-animation` with identical sample counts. The median startup/render overhead must not exceed 10%; prefer a 5-10% ceiling while recognizing that an individual first-load navigation can vary because of lazy initialization. Warm navigation medians are the stable tab-switch comparison.

---

## Adding New Tests

### For a pure function in `src/data/`:
Add a test in the corresponding `tests/*.test.ts` file.

```ts
test('description of what is verified', () => {
  const result = myFunction(input);
  expect(result).toEqual(expected);
});
```

### For a SQL/persistence concern:
Add to `tests/database.test.ts` or the relevant test file with a `:memory:` database.

### Test naming convention:
Describe the behavior, not the implementation. Good: `'appendWidget fills trailing row space or starts a fresh full-width row'`. Bad: `'appendWidget test'`.

---

## What Is Not Tested (Known Gaps)

- React component rendering (no jsdom, no @testing-library/react)
- Electron IPC round-trips (too integration-heavy for unit tests)
- Exhaustive pointer-drag collision permutations
- Calendar view switching
- Form validation UI

These gaps are acceptable for the current phase. Do not add heavy testing infrastructure without user direction.

---

## Acceptable Failure Conditions

The following do NOT constitute test failures:
- `bun run verify:ui` producing a screenshot with minor style differences (compare visually).
- TypeScript unused-variable warnings in test files (oxlint catches these, not tsc).

The following DO constitute blocking failures that must be fixed before any session ends:
- Any test in the suite failing.
- Any TypeScript error from `tsc --noEmit`.
- Any new oxlint error (warnings from the two known pre-existing cases are acceptable).
- `bun run verify:ui` exiting with a non-zero code.
