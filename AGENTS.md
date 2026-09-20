# Project working agreement

## MANDATORY AGENT STARTUP SEQUENCE

Every agent — regardless of model, session, or instruction source — **must** execute these steps in order before touching any code.

```
1. Read AGENTS.md (this file) completely.
2. Read the relevant docs/ file(s) for the work area.
3. Run: git status && git branch
4. Read docs/agent/CURRENT_WORK.md in full.
5. Update CURRENT_WORK.md BEFORE writing any code.
6. Complete the work.
7. Run verification (see below).
8. Update CURRENT_WORK.md before ending the session.
```

**"Chat history is not the project's source of truth. Repository documentation is."**

**"No TODO may exist only inside an AI conversation. If work remains, it must be written into CURRENT_WORK.md or docs/MVP_ROADMAP.md."**

**"Never mark work complete because code was written. Mark it complete only after applicable verification succeeds."**

Skipping any startup step is a protocol violation. Do not skip steps to save time.

---

## Core Rules (always apply)

- After any code change: run `bun run lint`, `bun run typecheck`, `bun run test`.
- For any UI change: also run `bun run verify:ui` and note the result.
- Keep `@shadcn/lint` rules opt-in. Do not enable design-system policy rules without explicit user direction.
- Ask before adding optional plugins, native hosts, external services, or completing a new application-stack layer beyond the requested scope.
- Keep `src/platform/` and `src/data/` fully independent from the React renderer. No React, Electron, or Vite imports in those layers.
- Do not migrate frameworks, runtimes, or bundlers. Stack is fixed: **Electron + Bun + React + Vite + TypeScript + Tailwind + shadcn/Radix + Bun SQL/SQLite**.
- Never add a dependency without explicit user approval.
- Never silently expand scope. If you identify related work, record it in CURRENT_WORK.md under "Remaining Work" and stop.

---

## CURRENT_WORK.md Protocol

Every agent session that changes code **must** maintain `docs/agent/CURRENT_WORK.md` with this exact structure:

```
# Current Work
## Objective
## Scope
### In Scope
### Out of Scope
## Current Repository State
## TODO
- [ ] uncompleted
- [/] in progress
- [x] completed
## Expected Files Touched
## Acceptance Criteria
## Implementation Notes
## Verification
## Completed This Session
## Remaining Work
## Known Regressions / Risks
## Exact Next Action
## Handoff Summary
```

Rules for CURRENT_WORK.md:
- Write the Objective and Scope **before** implementation begins.
- Use checkbox TODO items. Mark `[/]` when starting a task, `[x]` only after verification passes.
- List every file you plan to touch under Expected Files Touched.
- Do not mark Acceptance Criteria met until verification confirms it.
- Write Handoff Summary last — it must be enough context for a fresh agent to continue without asking.

---

## DECISIONS.md Protocol

Record in `docs/agent/DECISIONS.md` any decision that:
- Changes how a module is structured or where logic lives
- Adds, removes, or pins a dependency
- Changes a data model, schema, or API contract
- Resolves a conflict between two valid approaches

Format each entry:
```
## YYYY-MM-DD — Short title
**Context:** why the decision was needed
**Decision:** what was chosen
**Alternatives considered:** what was ruled out and why
**Consequences:** what this affects going forward
```

---

## Architecture Constraints (never violate without explicit user approval)

See `docs/ARCHITECTURE.md` for full detail. Summary:
- Renderer ↔ Bun service: IPC only through the preload bridge (`electron/preload.ts`).
- Bun SQL is the only database client. No ORM, no Prisma, no Drizzle.
- All pure domain logic lives in `src/data/` and `src/internships/`. Zero UI dependencies.
- All platform I/O lives in `src/platform/`. Zero React dependencies.
- shadcn components live in `src/components/ui/`. Do not write custom component primitives elsewhere.
- Styles live in `src/styles/globals.css`. Do not create additional global CSS files.
- `src/features/` contains React feature components only. No business logic.

---

## MVP Scope Reminder

See `docs/PROJECT_CONTRACT.md` and `docs/MVP_ROADMAP.md` for authoritative scope.

**Explicitly OUT of MVP (do not implement unless user explicitly overrides):**
- iPhone / mobile app
- Public hosting or cloud backend
- Authentication or user accounts
- Multi-device sync
- Google Calendar read/write integration
- ChatGPT / Gemini AI integrations
- Canvas LMS scraping
- Stripe or any payment system

These live in `docs/FUTURE_INTEGRATIONS.md`. Do not add stubs, placeholders, or config for them.

---

## Verification Commands

```sh
bun run lint        # oxlint — zero new errors required
bun run typecheck   # tsc --noEmit — zero errors required
bun run test        # bun test — all tests must pass
bun run verify:ui   # Electron screenshot smoke test (required for UI changes)
bun run check       # Runs typecheck + lint + test in sequence
```

A change is not complete until all applicable commands pass.

---

## Branch

Active development branch: `Native-Overhaul`
Do not merge to `main` or `Tauri-Overhaul` without explicit user instruction.
