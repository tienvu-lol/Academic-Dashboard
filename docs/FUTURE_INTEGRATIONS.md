# FUTURE INTEGRATIONS
## Academic Dashboard — Native-Overhaul Branch

These features are explicitly **out of MVP scope**. They are documented here so future agents know they exist as a vision without implementing them prematurely.

No agent may begin work on any item in this document without explicit written approval from the user. If a user requests one of these, create a dedicated spec document first and update `docs/MVP_ROADMAP.md` before writing any code.

---

## 1. iPhone / Mobile Application

**Vision:** A companion iOS app that shows today's tasks, upcoming deadlines, and calendar at a glance.

**Why deferred:** Requires a cloud sync backend, authentication, and a separate app build pipeline (React Native or Swift). This is a distinct product from the desktop app.

**Dependencies to unblock:** Cloud backend, multi-device sync.

---

## 2. Cloud Backend and Multi-Device Sync

**Vision:** SQLite data syncs across the user's devices (desktop + phone). No data leaves the user's control without consent.

**Why deferred:** Requires server infrastructure, authentication, conflict resolution, and ongoing operational cost. The app is designed to be zero-infrastructure; adding a server fundamentally changes the trust model.

**Candidate approach (when ready):** Self-hostable sync server (e.g., local LAN sync via libsql/Turso or CRDT-based sync). Avoid managed third-party databases.

---

## 3. Authentication / User Accounts

**Vision:** Sign-in so the app knows who you are across devices.

**Why deferred:** Currently unnecessary — the app is single-user, local-only. Auth adds complexity and a potential failure point for no current benefit.

**Note:** If cloud sync is added, auth becomes necessary at that point.

---

## 4. Google Calendar Integration

**Vision:** Read Google Calendar events (class schedule, appointments) into the Academic Dashboard calendar view. Optionally write tasks back as Google Calendar events.

**Why deferred:** Requires OAuth, API credential management, and handling Google's rate limits and scopes. The calendar view must be polished first before adding an external data source.

**Pre-requisite:** Calendar completion (Phase 3 of MVP).

**Candidate approach:** OAuth via Electron `shell.openExternal` + local callback server. Store tokens in OS keychain (not SQLite).

---

## 5. ChatGPT / Gemini AI Integrations

**Vision:** AI-powered features such as:
- "Summarize my week" natural language summary
- Automatic task prioritization suggestions
- "What should I do today?" assistant

**Why deferred:** Requires API keys, internet connectivity, and ongoing API cost. Adds a dependency on an external service that could become unavailable or change pricing. Privacy implications of sending academic data to a third party.

**If added:** Must be fully opt-in, clearly labeled, and store no data beyond the session.

---

## 6. Canvas LMS Scraping / Integration

**Vision:** Automatically import assignments from Canvas (or Blackboard, Moodle) so the student doesn't have to enter them manually.

**Why deferred:** Canvas has a public API, but accessing it requires OAuth and institution-specific base URLs. Scraping without an API violates Canvas ToS. This is high-complexity, low-reliability integration.

**Candidate approach (when ready):** Canvas REST API with user-provided API token (Canvas settings → "Approved integrations"). Import only, no write-back.

---

## 7. Public Hosting / Web Version

**Vision:** A web version of the dashboard accessible from any browser.

**Why deferred:** Requires a backend, authentication, database hosting, and a fundamentally different security model. The Bun SQL layer would need to be replaced with a web-compatible database. This is effectively a different product.

---

## 8. Push Notifications / Reminders

**Vision:** System notifications when a deadline is approaching (e.g., "Exam in 2 hours").

**Why deferred:** Electron supports system notifications, but scheduling them reliably requires a background service that runs even when the app is closed. This adds OS-level complexity (launchd/Task Scheduler) that is out of scope for the current phase.

**Candidate approach (when ready):** Electron's `Notification` API for in-app-open reminders. Background service via a system daemon for persistent reminders.

---

## 9. Collaborative / Shared Workspaces

**Vision:** Share a workspace with a study partner or TA.

**Why deferred:** Requires cloud backend, conflict resolution, permission model, and real-time sync. This is a multi-user product — a fundamentally different architecture from the current single-user local app.

---

## 10. Stripe / Payments

**Vision:** Paid tier for cloud sync or advanced features.

**Why deferred:** The app is not currently distributed publicly. Payments require business entity, terms of service, privacy policy, and ongoing legal/compliance work.

