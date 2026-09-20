# UI/UX CONTRACT
## Academic Dashboard — Native-Overhaul Branch

This file is the local source of truth for interface decisions. Future work must not depend on external design repositories to recover these principles.

---

## Product-Specific Direction

Academic Dashboard is a student workbench, not a marketing dashboard. Its visual language should resemble a well-kept desktop planner: quiet structure, compact rows, precise dates, and selective urgency.

The target qualities are:

- Sleek, dense, calm, and fast.
- Desktop-native rather than browser-template-like.
- Minimal visible components carrying maximum useful information.
- Dark and cream, with blue for interaction, green for completion, and red reserved for true urgency or destructive action.

The Dashboard must answer these questions in seconds:

1. What needs attention?
2. What is due soon?
3. What should I work on next?
4. What does today or this week look like?
5. What is coming after that?

### Primary scan path

```text
Page and date
    ↓
Immediate urgency
    ↓
Tasks and next actions
    ↓
Today / week schedule
    ↓
Secondary history, notes, and courses
```

Do not make every region equally loud. Task work is primary, schedule is supporting context, and analytics/courses are secondary.

---

## Adopted Design Principles

The following guidance was distilled from the user-supplied UI UX Pro Max and Anthropic frontend-design references and adapted to this product:

- Start with the product's real job and real content. Generic dashboard conventions are not a substitute for hierarchy.
- Plan visual direction before implementation: define a small token set, typography roles, layout concept, and wireframe.
- Structural devices are information. A border, label, badge, icon, or color must communicate hierarchy, grouping, interaction, or state; otherwise remove it.
- Spend visual emphasis in one place. On the Dashboard, the task surface and immediate urgency receive emphasis; surrounding regions stay disciplined.
- Prefer high-density dashboard spacing while protecting readability and keyboard targets.
- Use motion only to explain a user-triggered change. Avoid ornamental entrances, constant hover movement, and decorative animation.
- Treat copy as navigation. Use short, plain, consistent labels that describe what an action does.
- Design text and badges to reflow without clipping. Never rely on color alone for status.
- Critique screenshots after implementation and remove at least one unnecessary visual element before delivery.
- Accessibility, responsive behavior, and reduced-motion support are part of the quality floor, not optional polish.

References reviewed on 2026-09-20:

- `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`
- `https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md`

The repositories are references only. Do not install either as an application dependency.

---

## Compact Token System

Use semantic tokens in shared CSS. Do not add near-duplicate shades when an existing token works.

### Color

| Token | Value | Purpose |
|---|---:|---|
| Background | `#000000` | App canvas and title bar |
| Primary surface | `#080808` | Main work surfaces |
| Interactive surface | `#171715` | Hover, selected controls, raised controls |
| Text primary | `#FFF7E4` | Headings and primary data |
| Text secondary | `#9A958B` | Supporting labels and metadata |
| Subtle border | `#292925` | Dividers and meaningful containment |
| Accent | `#5D9DFC` | Primary action, selection, links |
| Positive | `#78A985` | Completed and healthy states |
| Warning | `#D9A441` | Due soon when distinction is needed |
| Destructive | `#FF5C5C` | Overdue, destructive actions, errors |
| Focus | `#8DB9FF` | Keyboard focus ring |

### Density and dimensions

| Token | Values / rule |
|---|---|
| Spacing | `4, 8, 12, 16, 24, 32px` |
| Type scale | `11, 12, 14, 18, 26px` |
| Radii | `4px` controls/chips, `8px` panels/dialogs, `12px` only for exceptional large surfaces |
| Control height | `32px` standard, `28px` compact toolbar |
| Icon sizes | `14px` inline, `16px` controls, `18px` section identity |
| Task row | `44–52px` depending on metadata wrapping |
| Page gutter | `clamp(16px, 3vw, 40px)` |
| Content width | `1320px` maximum; test 1200–1360px if composition changes |

Body text uses the native Segoe UI/system stack. Do not import fonts. Use weight, width, spacing, and numeric alignment deliberately. Avoid uppercase labels except a genuinely conventional abbreviation or code.

---

## Dashboard Layout Contract

### Wide desktop concept

```text
┌──────────────────────── centered workbench: max ~1320px ────────────────────────┐
│ Sunday, September 20                                      [ + Add task ]         │
│ Dashboard                                                                        │
├──────────── compact attention strip: due soon / active / overdue ───────────────┤
│                                                                                  │
│ Tasks  8                 [Search________] [Status] [Category] [More]              │
│ ──────────────────────────────────────────────────────────────────────────────── │
│ □ Assignment title             Course        Priority        Due       Actions   │
│ □ Reading response             Category      Medium          Tomorrow   ·  ·      │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Schedule                                        [Month] [Week] [Day]              │
│ compact calendar / time grid with restrained empty cells                         │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Secondary widgets: activity, notes, courses                                      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Responsive behavior

- The workbench is centered with intentional outer gutters; it must not expand indefinitely on large displays.
- At narrower desktop widths, control groups wrap before table content becomes unreadable.
- Arbitrary side-by-side user widget layouts stack when the available window is too narrow to preserve legibility.
- Task rows may horizontally scroll only as a last resort inside their own surface; the page itself must never overflow horizontally.
- Calendar cells become shorter on wide sparse month views, but must preserve readable dates, status counts, and task titles.
- Below the existing narrow breakpoint, widgets stack in reading order.

---

## Component Hierarchy

### Page header

- Show the human-readable date and page title as a single compact block.
- Dashboard has one obvious `Add task` action. Do not repeat it inside the task surface.
- Supporting copy is optional and should be omitted when it repeats the page's purpose.

### Summary strip

- Due soon, active/total tasks, and overdue remain visible near the top.
- Treat them as a compact status strip, not three hero cards.
- Numbers use tabular figures and modest scale. Red appears only when overdue is nonzero or a state is genuinely urgent.
- Labels and icons ensure status is not communicated by color alone.

### Task surface

- Tasks are the dominant Dashboard surface.
- Prefer rows, aligned columns, typography, and subtle dividers over cards per task.
- Preserve completion, priority, course/category, due date, edit, delete, search, filters, drag reorder, and Alt+Arrow keyboard reorder.
- Keep search and filters in one logical control band. Secondary configuration actions belong near the section title but remain visually quiet.
- Use one compact metadata line under the task title. Do not color an entire row unless a state warrants it.
- Overdue state must include text, not only red color.
- Destructive row actions remain quiet until hover/focus but keep accessible names.

### Calendar / schedule

- Calendar is supporting context, not the page hero.
- Keep month/week/day behavior intact unless the calendar phase explicitly changes it.
- Reduce empty-cell height before hiding useful information.
- Use restrained workload tint, compact event rows, and a short legend.
- Calendar controls stay in one header region and do not compete with the Dashboard's primary action.

### Secondary information

- Activity, notes, and courses follow the schedule.
- These regions may use panels when containment is meaningful, but should not repeat decorative headers, subtitles, and borders without purpose.

---

## Containers, Borders, and Corners

- Do not wrap every conceptual group in a card.
- Main work surfaces may use one quiet border and an `8px` radius.
- Task rows use dividers, not nested cards.
- Summary items should read as one strip or a coordinated sequence, not independent promotional tiles.
- Use square or small-radius table/header geometry where it reinforces alignment.
- Shadows and gradients are not decorative defaults. Use neither on the Dashboard unless a temporary overlay needs depth.

---

## Interaction Standards

### Buttons and controls

- Use shadcn/Radix primitives already in the repository.
- Hierarchy: one filled primary action per region; outline/secondary for bounded alternatives; ghost for toolbar and row actions.
- Every icon-only control needs an accessible name and a tooltip/title when its meaning is not obvious.
- Standard controls are `32px` tall; dense toolbar controls may be `28px`. Pointer targets should gain surrounding spacing where the visible icon is smaller.

### Drag and drop

- Widget reorder/dock uses the edit-mode grip and visible drop zones.
- Task reorder uses the row grip; Alt+Up/Down remains the keyboard alternative.
- Drag feedback must identify the target and must not depend only on color.

### Motion

- Page changes are instant.
- Motion may clarify opening, collapsing, saving, dragging, or revealing the sidebar.
- Respect `prefers-reduced-motion` and never require animation to understand state.

### Forms and dialogs

- Editors use semantic dialogs and close on Escape or their close control.
- Visible labels are required; placeholders do not replace labels.
- Errors appear near the relevant context when practical.
- Destructive actions require confirmation.

---

## Accessibility Contract

- All functionality is keyboard reachable in reading order.
- Focus is always visible and not clipped by overflow containers.
- Icon buttons have accessible labels; unfamiliar icons expose a title/tooltip.
- Status meaning uses text or an icon in addition to color.
- Text contrast targets WCAG AA (4.5:1 for normal text, 3:1 for large text and component boundaries where applicable).
- Text, badges, and controls reflow under window narrowing, zoom, and longer labels.
- Live save/reorder results use a polite status region.
- Radix focus management remains intact.

---

## Patterns to Avoid

- Full-bleed meaningful content on very wide windows.
- Giant summary cards or marketing-scale numbers.
- Multiple equally prominent `Add task` actions.
- A card around every row or section.
- Decorative gradients, glows, and ornamental motion.
- One universal border radius applied to every element.
- Acid-green-on-black styling or gratuitous neon.
- Tracked all-caps eyebrow labels above every heading.
- Duplicate labels and explanatory copy that merely restate visible content.
- Hover-only functionality, removed focus rings, or color-only state.
- Page-level horizontal overflow or accidental nested scrolling.
- Fixed widget heights unless the user explicitly enables Pin.
- New global CSS files; shared styles remain in `src/styles/globals.css`.

---

## Edit Layout Mode

When edit mode is active:

- Preserve the existing widget drag, dock, keyboard move, width resize, empty-slot, append-zone, reset, and explicit Pin behavior.
- Editing chrome should be visually subordinate to the content while remaining discoverable.
- Width resizing must never assign a height.
- Pin is the only action that creates an internal widget scrollbar.
- Drop zones identify their purpose with shape/text as well as color.

---

## Visual Review Checklist

After UI changes, run the Electron app and review representative screenshots. Ask:

- Is anything unnecessarily huge?
- Is any action or label duplicated?
- Can the screen be understood in five seconds?
- Does the scan path move from date to urgency to tasks to schedule?
- Are there too many rectangles, controls, borders, or badges?
- Does empty space establish hierarchy, or is it merely unused?
- Do task and calendar content remain legible at narrower desktop widths?
- Are urgency and completion understandable without color?
- Does this look intentionally designed for a student desktop workflow?

Then remove one unnecessary visual or textual element and rerun applicable verification.

---

## Verification

UI changes are complete only after:

1. `bun run lint`
2. `bun run typecheck`
3. `bun run test`
4. `bun run verify:ui`
5. Visual review of representative desktop screenshots, preferably 1280x800, 1440x900, and 1600x900.
