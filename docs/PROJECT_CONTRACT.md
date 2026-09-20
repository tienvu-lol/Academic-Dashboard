# PROJECT CONTRACT
## Academic Dashboard — Native-Overhaul Branch

---

## Product Definition

Academic Dashboard is a **student-first academic command center** whose primary job is to let a student immediately understand:

- **What they need to do** — tasks, assignments, to-dos by priority
- **What is urgent** — overdue items and what is due within the next 48 hours
- **When things are due** — calendar view across month / week / day
- **What their current day/week schedule looks like** — time-block aware day/week views

It is a local-first, offline-capable desktop application. There is no server, no account, no sync. Data lives on the user's machine in a SQLite database owned entirely by the student.

---

## Design Philosophy

- **Immediate clarity over feature density.** The dashboard should answer "what do I do today?" without any clicking.
- **Calm, not alarming.** Red is used sparingly and meaningfully — only overdue or high-urgency items.
- **Student-owned data.** No telemetry, no cloud uploads, no external dependencies at runtime.
- **Stable and trustworthy.** A tool a student uses every day must not glitch, lose data, or confuse them.
- **Keyboard and mouse parity.** Every core action must be reachable without a mouse.

---

## Current MVP Priorities

Listed in priority order. Higher items block lower items.

| # | Area | Status |
|---|------|--------|
| 1 | Dashboard + task tracking | Mostly implemented — needs UI/UX polish |
| 2 | Major UI/UX refinement | In progress (Native-Overhaul) |
| 3 | Calendar (month / week / day views) | Mostly implemented — needs polish |
| 4 | Reliable time-block creation | Partially implemented |
| 5 | Recurring class / event support (semester date ranges) | Not yet implemented |
| 6 | Current-time indicator in week/day views | Not yet implemented |
| 7 | Layout system stability | Recently overhauled — stabilizing |

---

## What Is Definitively OUT of MVP

The following items are explicitly deferred. **No agent may implement these without explicit user approval.** They are documented in `docs/FUTURE_INTEGRATIONS.md`.

- iPhone / mobile application
- Public hosting or web deployment
- Authentication / user accounts
- Multi-device sync
- Google Calendar read or write integration
- ChatGPT / Gemini AI chat integrations
- Canvas LMS scraping or integration
- Cloud backend of any kind
- Stripe or payment processing
- Push notifications
- Collaborative / shared workspaces

---

## Non-Negotiable Technical Constraints

1. **Stack is fixed.** Electron + Bun + React + Vite + TypeScript + Tailwind CSS v4 + shadcn/Radix + Bun SQL/SQLite. Do not migrate any layer.
2. **Local-first.** All data persists to SQLite via `Bun.SQL`. No network writes at runtime.
3. **Renderer sandbox.** The React renderer has no Node.js access. All platform I/O goes through the preload bridge → Bun service.
4. **No new runtime dependencies** without explicit user approval. Use what is already in `package.json`.
5. **No destructive migrations** without explicit user approval. Schema changes must be additive.

---

## Acceptance Standard

A feature is complete when:
1. It works correctly in the Electron window (not just in a browser tab).
2. `bun run check` (typecheck + lint + test) passes with no new failures.
3. `bun run verify:ui` completes without error.
4. No regressions are introduced in existing features.

---

## Stakeholder

Solo student developer. There are no external stakeholders, product managers, or review cycles. The agent is trusted to make implementation decisions consistent with this contract, but must document significant decisions in `docs/agent/DECISIONS.md`.

