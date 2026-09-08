# Academic Dashboard

Exported source for the Fibery Academic Dashboard. The project uses Vite, React 18, TypeScript, Tailwind CSS 4, React Query, and Recharts.

## Open and run in VS Code

Requirements:

- Node.js 20 or newer
- pnpm 9 or newer (`corepack enable` can install the package manager bundled with Node)

From a terminal:

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Vite. You can also run **Terminal → Run Task** in VS Code and choose **Dashboard: Start development server**.

## Validate and build

```bash
pnpm typecheck
pnpm build
pnpm preview
```

The production build is written to `dist/`. The included VS Code default build task runs the same Vite production build.

## Important Fibery runtime note

This dashboard reads and writes workspace data through Fibery's authenticated, same-origin `/api/commands` interface. A normal local or static deployment can compile and render the app, but its live assignments, courses, calendar events, notes, and completed-work actions require it to run as a Fibery Custom App.

To retain full functionality, edit and test the source in VS Code, then deploy it through the Fibery Custom App development/upload flow. Never put a Fibery development token in the source code, `.env` files committed to Git, or browser-side JavaScript.

## Main files

- `src/App.tsx` — dashboard layout and data orchestration
- `src/dashboard.ts` — shared data types and presentation helpers
- `src/completeWork.ts` — safe archive-first completion flow
- `src/TaskEditor.tsx`, `src/QuickAdd.tsx`, `src/CompletedEditor.tsx`, `src/CourseEditor.tsx` — interactive editors
- `src/NotesPanel.tsx` — dashboard notes
- `src/lib/fibery.ts` — Fibery API bridge supplied by the custom-app platform

Generated directories such as `node_modules/` and `dist/` are intentionally excluded from the export.
