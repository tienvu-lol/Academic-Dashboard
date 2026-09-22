# Architecture Decisions Log
## Academic Dashboard — Native-Overhaul Branch

Decisions are recorded here when they change module structure, add/remove dependencies, change data models, or resolve meaningful implementation forks. Trivial implementation choices do not require an entry.

---

## 2026-09-21 — Native coordinate grid and measured motion

**Context:** The requested edit experience referenced GridStack and Motion, but adding dependencies requires explicit approval. The existing ordered-span HTML drag/drop editor could not provide reliable two-axis placement, frame-batched previews, or deliberate vertical resizing. Page switching also mounted hundreds of tooltip primitives in the activity heatmap.

**Decision:** Keep the implementation dependency-free. Add optional paired `column`/`row` fields to the backward-compatible layout model, a pure collision-safe placement engine, and Pointer Events with one preview update per animation frame and one persistence write on release. A deliberate vertical resize may now set the same height cap as Pin; horizontal-only movement never sets height. Add native CSS/IntersectionObserver motion with reduced-motion handling, and replace per-cell heatmap tooltip trees with native accessible labels. This supersedes the 2026-09-20 width-only interaction decision while retaining its protection against accidental height assignment.

**Alternatives considered:** Install GridStack and Motion (not authorized and unnecessary for the bounded behavior); retain HTML drag/drop and dock zones (insufficient for responsive coordinate movement); keep multiple pages mounted to accelerate switching (rejected after Electron exposed hidden zero-size chart warnings and duplicate controls).

**Consequences:** Legacy layouts normalize without migration, new layouts may persist explicit coordinates, collision logic remains testable outside React, and narrow rendering stacks without changing saved desktop geometry. Motion has no runtime package cost. The production Electron benchmark is now the regression gate for future animation and page-switch changes.

---

## 2026-09-20 — Width-only resize handle; height as explicit opt-in

**Context:** The resize handle in `widget-layout.tsx` tracked both X and Y mouse movement. Any tiny vertical drift during a horizontal drag would call `resizeWidget(..., newHeight)`, permanently setting a `height` value on the widget. This caused: (1) accidental fixed-height mode with scrollbars on any widget the user tried to resize, and (2) visual glitchiness from continuous re-renders on pointer move.

**Decision:** The resize handle now tracks only `clientX`. The `resize.current` ref no longer stores `y` or `height`. Height is controlled exclusively via a `Minimize2` pin toggle button in the edit bar. When pinned, `maxHeight` (not `height`) is used so the widget clips only when content genuinely exceeds the cap; content shorter than the cap flows naturally with no scrollbar.

**Alternatives considered:**
- Keep bidirectional resize but require a threshold vertical movement before activating height mode: rejected because threshold logic is difficult to tune and the separate "pin" button is cleaner UX.
- Remove the resize handle entirely and use only the width dropdown: rejected because drag-to-resize is faster for casual adjustments.

**Consequences:** Any `item.height` values saved by older sessions will still apply when those users open the app. They will need to unpin manually (one click). A future migration could strip `height` from layouts on first load, but this is deferred.

---

## 2026-09-20 — Append zone and slot zones for empty-space drop

**Context:** The default dashboard layout has all rows at exactly 12 columns, so `emptySlots()` always returned `[]` — there were no partial rows. Users could not drop widgets into the empty black area below the last widget row, only onto other widgets.

**Decision:** Added a `widget-append-zone` div rendered *below* the `widget-grid` div (outside the CSS Grid, not inside). This zone is visible only when a drag is in progress. Dropping into it calls `appendWidget()`, which places the source widget in the last row's trailing slack (≥3 cols) or starts a new full-width row. Also fixed `emptySlots()` to compute from `saved.filter(x => x.id !== source.current)` so the dragged widget's vacated space is visible as available.

**Alternatives considered:**
- Expand the CSS Grid itself to always show an empty trailing row: rejected because it creates visual noise and conflicts with the natural-height design.
- Use a portal to render the append zone outside the widget grid DOM: rejected as unnecessary — a sibling div works correctly.

**Consequences:** The append zone only appears during active drag (`dragging === true`). This is intentional — showing it always would be visual clutter in normal view.

---

## 2026-09-20 — `maxHeight` instead of `height` for pinned widgets

**Context:** The previous implementation used `style={{ height: item.height }}` for pinned widgets. This forced the widget to exactly that height even when content was shorter, creating ugly empty space at the bottom.

**Decision:** Changed to `style={{ maxHeight: item.height }}`. Now: (1) if content is shorter than the pinned value, the widget shows at natural content height with no empty space and no scrollbar; (2) if content is taller than the pinned value, the widget clips and shows a scrollbar. This is strictly better UX for all cases.

**Alternatives considered:** Using `min-height` instead: rejected — that would not clip tall content.

**Consequences:** The `widget-fixed-height > .panel { min-height: 100%; }` CSS rule was removed (it was written for the old fixed-height semantics and caused panels to expand to fill empty space). The `min-height: 140px` on `.widget-fixed-height` was also removed (enforced by `resizeWidget`'s JS clamp to `Math.max(140, ...)`).

---

## 2026-09-20 — Project documentation scaffold established

**Context:** The project had a 7-line `AGENTS.md` that was insufficient for reliable agent handoffs. Chat history was serving as the source of truth, which is fragile.

**Decision:** Created a full documentation suite in `docs/`: `PROJECT_CONTRACT.md`, `ARCHITECTURE.md`, `UI_UX_CONTRACT.md`, `MVP_ROADMAP.md`, `CALENDAR_SPEC.md`, `QA_CONTRACT.md`, `FUTURE_INTEGRATIONS.md`, and `docs/agent/` files. `AGENTS.md` was rewritten to be a complete permanent agent protocol document. The principle: repository documentation is the source of truth, not chat history.

**Alternatives considered:** Storing context in a single large `CONTEXT.md`: rejected because a single file becomes unwieldy and harder to update incrementally.

**Consequences:** Every future agent must read these documents before beginning work. The `AGENTS.md` startup sequence is mandatory. `docs/agent/CURRENT_WORK.md` must be updated before and after every working session.

---

## 2026-09-20 — Scheduled events are a separate additive domain

**Context:** The original Schedule widget projected task due dates into month/week/day views. Weekly classes and meetings require duration, recurrence, and series lifecycle behavior that do not belong to the assignment/to-do completion model. Treating them as fake tasks would pollute task counts, ranking, completion history, and imports.

**Decision:** Add `CalendarEvent` and weekly recurrence types in `src/data/calendar.ts`, expose an additive `calendarEvents` collection on workspace version 2, and persist one row per event series in a dedicated `calendar_events` SQLite table. Occurrences are virtual and expanded only for the visible date range. Editing and deleting always affect the whole series for this MVP; per-occurrence exceptions are explicitly out of scope.

**Alternatives considered:** Add recurrence fields to academic tasks; rejected because scheduled time and actionable work have different semantics. Store every occurrence as a database row; rejected because it duplicates semester series, complicates edits, and creates avoidable synchronization problems. Increase the workspace version; rejected because the field/table addition is backward-compatible and older databases can default to an empty event list.

**Consequences:** The planner renders tasks and events together but styles and labels them distinctly. Event validation and date expansion stay in the pure data layer. The preload/API surface does not change because the existing atomic workspace snapshot already carries the new collection. Per-occurrence completion, edits, cancellations, and recurrence exceptions require a future model extension.
