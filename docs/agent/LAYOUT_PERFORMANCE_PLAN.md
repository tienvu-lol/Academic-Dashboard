# Layout, Performance, and Motion Execution Plan

This file is the durable implementation guide for the active request. `CURRENT_WORK.md` records live status; update both after each phase.

## Completion snapshot — 2026-09-21

All five phases are complete. Required checks pass, the screenshot suite is reviewed, and the final animation benchmark stays within the startup/warm-navigation budget. The authoritative implementation/results handoff is in `CURRENT_WORK.md`; keep this document as the resume procedure and regression plan.

## Non-negotiable constraints

- Preserve all existing features and the default Dashboard/Internships visual order.
- Do not add GridStack, Motion, or any dependency without explicit user approval.
- Keep pure packing/collision logic in `src/data/layout.ts`; keep DOM and pointer logic in `src/features/widget-layout.tsx`.
- Preserve legacy saved layouts. New optional placement fields must normalize safely when absent.
- Pin remains the only feature that creates an internal widget scrollbar.
- Run the complete required verification after code changes and visually inspect Electron artifacts.

## Phase 0 - audit and baseline

1. Inspect `layout.ts`, `widget-layout.tsx`, App page switching, related CSS, layout tests, and UI harness.
2. Add `scripts/benchmark-ui.ts` using the existing Electron/CDP launch utilities; do not add packages.
3. Measure at least five samples and report medians for:
   - cold launch to workspace-ready Dashboard;
   - Dashboard -> Daily notes -> Dashboard;
   - Dashboard -> Internships -> Dashboard;
   - click-to-next-paint (two animation frames after the requested page marker appears).
4. Store results as console output and copy the dated median table into `CURRENT_WORK.md`/worklog. Do not commit volatile artifact JSON unless explicitly useful.

## Phase 1 - pure grid model

Target placement shape: retain `id`, `span`, and optional `height`; add optional explicit `column` and `row` only if required. Missing coordinates must be derived with stable 12-column first-fit packing.

Required invariants:

- column range is 1-12 and `column + span - 1 <= 12`;
- spans remain 3-12 desktop columns;
- no two normalized rectangles overlap;
- moving/resizing one widget compacts deterministically without losing IDs;
- legacy ordered-span layouts produce the same default composition;
- responsive rendering may stack visually without rewriting saved desktop geometry.

Add focused unit tests for normalization, collision push-down, move, width/height resize, bounds, legacy compatibility, and validation.

## Phase 2 - edit-mode interaction

- Replace HTML drag/drop docking with Pointer Events on the existing grip.
- On pointer down, capture the pointer and snapshot the base layout/grid metrics.
- On pointer move, store the latest coordinates in a ref and schedule at most one `requestAnimationFrame`; update only the placement preview once per frame.
- Render a clear placeholder/ghost and move the active widget with `translate3d`; use transient `will-change` only during interaction.
- Commit one persistence update on pointer up. Cancel restores the base layout.
- Resize from the southeast handle on both axes. Width snaps to columns. Height remains natural unless the user deliberately crosses the vertical threshold; never create accidental clipping.
- Preserve reset, Pin, live announcements, and Alt+Arrow controls. Add documented keyboard resize shortcuts.
- Avoid page-level overflow; edit chrome may wrap and must not cover content controls.

## Phase 3 - renderer optimization

- Profile before changing. Prioritize verified waste: recreated widget arrays/derived collections, expensive page remounts, synchronous navigation work, and per-pointer React updates.
- Use `useMemo`, `useCallback`, `memo`, or `startTransition` only where measurements/render boundaries justify them.
- Prefer preserving page state with a small mounted-page cache only if memory and stale-state behavior remain correct.
- Never hide, simplify, or defer visible content merely to improve a timing number.
- Re-run the benchmark and required checks. This is the gate before reading the animation references.

## Phase 4 - animation reference review and native motion

Only after Phases 1-3 work:

1. Read the supplied gist and official Motion repository/documentation.
2. Record the adopted principles in `docs/UI_UX_CONTRACT.md`.
3. Capture the pre-animation benchmark.
4. Implement without a new dependency unless the user explicitly approves one:
   - short opacity/translate page reveal;
   - responsive button/toolbar press and hover states;
   - subtle one-time widget presence on scroll, preferably with IntersectionObserver;
   - direct drag feedback already provided by Phase 2.
5. Animate only transform/opacity when practical. Respect `prefers-reduced-motion`. Never delay navigation or input.
6. Re-run identical samples. Post-animation medians must be no more than 10% slower than pre-animation; target 5-10%. If outside budget, reduce scope/duration and re-measure.

## Phase 5 - completion

- Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run verify:ui`.
- Review layout edit, drag preview, resize, reset, wide/narrow Dashboard, calendar, notes, internships, and reduced motion.
- Update architecture, UI/UX, QA, roadmap, decision log, worklog, and `CURRENT_WORK.md`.
- The final handoff must include baseline/pre-animation/post-animation medians, percentage deltas, verification results, and any remaining risks.

## Resume protocol

At interruption, update `CURRENT_WORK.md` with the last passing command, exact failing command/error, files changed, benchmark stage completed, and one exact next action. Do not leave the only copy of a TODO in chat.
