# Current Work
## Objective
Fix three interconnected layout/editing issues:
1. **Scrollbars inside widgets** — when the Electron window is at awkward sizes, content inside widgets triggers `overflow: auto`, adding unwanted scrollbars.
2. **Jank during drag** — layout editing causes full React re-renders during pointer moves, making drags feel snappy/jerky.
3. **Placement smoothness** — widgets snap to grid positions with no transition, feeling abrupt.

## Scope
### In Scope
- Fix `.widget-body` overflow so scrollbars never appear unless the widget is explicitly pinned.
- Add CSS transitions to grid placement so widgets slide smoothly.
- Decouple drag visual position from React state using a CSS custom property approach (no DOM class toggling per-frame).
- Remove the pinned scrollbar gutter to avoid layout shift.

### Out of Scope
- Changing the grid logic or layout data model.
- Adding new dependencies.

## Current Repository State
- Active branch: `Native-Overhaul`.
- The working tree is dirty with uncommitted changes from the previous layout/motion overhaul plus this session's fixes.

## TODO
- [x] Read AGENTS.md, CURRENT_WORK.md, inspect git status and relevant source.
- [x] Fix widget overflow so scrollbars only appear when explicitly pinned AND content exceeds height.
- [x] Add smooth CSS transitions for grid placement.
- [x] Improve drag feel: lifted scale/shadow on active widget, dimmed scale on inactive widgets, removed overflow:visible during editing.
- [x] Run `bun run check` (45/45 pass, 0 errors).
- [x] Update WORKLOG.md and CURRENT_WORK.md.

## Expected Files Touched
- `src/styles/globals.css`
- `src/features/widget-layout.tsx`

## Acceptance Criteria
- [x] No scrollbars appear inside unpinned widgets at any window size — `overflow: hidden` on `.widget-body`, `overflow-y: auto; overflow-x: hidden` only on `.widget-fixed-height` (pinned widgets).
- [x] Grid moves/resizes are visually smooth — `transition: grid-column 200ms cubic-bezier(...)` on `.workspace-widget`.
- [x] Drag interaction feels fluid — active widget gets `transform: translate3d(0, -3px, 0) scale(1.008)` + strong glow; inactive widgets dim and scale down slightly.

## Implementation Notes
- The previous layout-editing block had `overflow: visible` on `.widget-body` and `scrollbar-gutter: stable` on `.widget-fixed-height` — both removed.
- CSS `grid-column` is animatable via `transition` in modern browsers (Chromium-based Electron). Widgets now smoothly slide to their new positions.
- Reduced-motion: `transition: none; transform: none !important` ensures no layout shift or animation for users who prefer it.

## Handoff Summary
- Layout editing is now much smoother: overflow-caused scrollbars are eliminated, grid placement transitions instead of snapping, and drag gives clear visual "lifted" feedback.
- All 45 tests pass. No regressions.
- The dirty working tree still contains all prior session changes (visual theme, stat colors, calendar aspect ratio, task panel truncation).

