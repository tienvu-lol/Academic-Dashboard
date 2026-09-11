# Academic Dashboard

A local academic workspace and internship application tracker built with React, TypeScript, Vite, Tailwind CSS, React Query, and Recharts. The warm dark palette is defined in the app; it no longer relies on Fibery to provide colors, icons, or a hosted API.

## Run

Use Node.js 24 and pnpm 9.4 or newer compatible versions.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite. Use the same browser and site address to access your saved records. The app starts empty until you create records or import your own exports.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

The optional `pnpm test:browser` runs an isolated headless Chrome smoke check against the running dev server at `http://127.0.0.1:5173`. Set `DASHBOARD_URL` or `CHROME_PATH` to override these defaults. It creates test records in a separate browser profile and stores screenshots under `.vite-cache/`; it never opens your normal browser profile. Unit tests use Node 24's TypeScript support and do not need another test dependency.

## Pages

- **Academics:** assignments, to-dos, notes with Markdown preview, workload calendar, completion chart, and courses by term. Add, edit, complete, and delete local records. Settings control visible sections, compact rows, and the first day of the week.
- **Internships:** editable opportunities, manual application tracking, semester chart, custom tags and notes, search, filters, sorting, pagination, and an outcomes section. Page settings control semester dates, application goal, and row spacing.
- **Import & backup:** preview and import Fibery CSV/JSON exports, inspect record counts, and download academic backups.

Google Calendar import is disabled, including for previously saved preferences. The workload calendar continues to show your local tasks. No data sources refresh automatically, and the daily quotes and SVG icons are bundled locally.

## Bring over Fibery data

Choose **Import & backup**, select a collection, and choose its exported CSV or JSON file. Preview the recognized records and warnings, then click **Import**. Import Courses first so assignments can resolve course references by ID or name. Unknown fields and unresolved course references are retained for future mapping.

CSV needs headers and a `Name` or `Title` column. Quoted commas and multiline content are supported. JSON accepts an array, `{ "entities": [...] }`, `{ "data": [...] }`, or a collection-named array such as `{ "University/Assignments": [...] }`. Namespaced fields such as `University/Name` and `fibery/id` are supported. Use `YYYY-MM-DD` dates or ISO timestamps.

| Collection | Additional recognized fields |
| --- | --- |
| Courses | Credit Hours / Credits; Academic Year / Semester / Term; Description |
| Assignments | Due Date / Deadline; Course; Priority; State / Status; Description |
| To-Dos | Due Date / Deadline; Category; State / Status; Description |
| Completed Work | Completion Date; Original Due Date; Course; Category; Priority; Type |
| Dashboard Notes | Markdown / Content / Text / Body |

For example, a Courses CSV can contain:

```csv
Name,Credits,Term
ECE 1004,3,Fall 2026
```

Imports add records and skip matches by ID or name/date/course/term; they do not overwrite your edits. A malformed academic row prevents that import from committing. Custom category, priority, and term names become available as select options.

Export descriptions as Markdown text or document JSON. A Fibery document secret alone does not include its text. Imported rich-text JSON and comments are retained in backups; description edits are stored as a local Markdown overlay. Remote attachments are not downloaded, and ZIP archives must be extracted before choosing their CSV/JSON files.

## Import Summer 2027 internships

Source: [SimplifyJobs/Summer2027-Internships](https://github.com/SimplifyJobs/Summer2027-Internships).

1. Open **Internships > Import** and follow **Open Simplify README**.
2. Save the raw README as a file, or copy its contents into the import dialog. The importer accepts its HTML tables as well as Markdown tables, CSV, and JSON listings.
3. Set the snapshot date to the day you downloaded the source. Relative ages such as `2d` use that date to determine the listing date.
4. Choose the initial availability for new opportunities, review the preview, and import.

Generic CSV/JSON imports create opportunities with Company, Role/Title, Location, URL/Application Link, Listed Date/Age, Deadline, Notes, and Tags. They do not infer your personal application progress from a source listing. This app's JSON backups preserve the saved application history. Reimported matches are skipped, preserving your manual statuses, notes, and dates. Tracking parameters in application links are ignored when matching duplicates.

**Availability is always manual.** Neither a passed deadline nor a source closure indicator changes Open/Closed in your tracker. Edit a record to enter its Date sent, then an outcome and outcome date. Accepted, Rejected, and Ghosted are recorded manually. Applied records whose deadlines have passed appear in Needs review while awaiting a response. An unknown deadline remains unknown; no deadline is invented from the repository's Age column.

The chart spans the selected semester:

| Line | Meaning |
| --- | --- |
| Grey | Cumulative opportunities by listed date, or date added when listing date is unknown |
| Lavender | Cumulative applications by Date sent |
| Glowing green | Accepted records by outcome date |
| Red | Rejected records by outcome date |

Records before the selected semester form its opening balance. Future days stay blank. The chart uses all records regardless of table filters; the sending goal counts only applications sent within the selected semester. Correcting an application or outcome date updates the chart; it represents current recorded history, not an immutable event log. Ghosted records are tracked in the outcomes section rather than an additional chart line.

The default term is VT Fall 2026, August 24 through December 16. Spring 2027 and custom dates are available. Presets follow the [Virginia Tech academic calendar](https://www.registrar.vt.edu/dates-deadlines/academic-calendar/2026-2027.html); semester settings remain editable.

## Storage and backups

Records are stored in this browser's local storage. No Fibery credentials, backend, or cloud database is required. Download academic backups from Import & backup and internship backups from Internships. Restore by importing these JSON files; restores merge records and preserve existing matches. Internship record imports do not replace your current semester settings.

Browser storage belongs to the current browser/profile and site origin, not to the project directory. Export backups before clearing site data or moving to another browser/device/origin. Storage errors are displayed instead of silently replacing unreadable records; the recovery download preserves the raw stored value.

## Source structure and future native migration

Every `.tsx` file lives under `src/dashboard-components/`:

```text
src/
  dashboard-components/
    main.tsx                  # React entry point
    App.tsx                   # Sidebar, navigation, lazy-loaded pages
    academic/                 # Academic page, settings, notes, editors
    internships/              # Internship page, table, chart, dialogs
    data/                     # Fibery import and backup interface
    shared/                   # Dialog, badges, Markdown, error boundary
  data/
    academic.ts               # Versioned academic repository and storage port
    academicImport.ts         # Fibery normalization and additive import
  internships/
    model.ts                  # Records, validation, chart series
    importing.ts              # README, CSV, JSON import and deduplication
    storage.ts                # Replaceable key/value persistence port
    useInternships.ts          # Browser/React state adapter
  lib/fibery.ts               # Local compatibility facade for migrated editors
  dashboard.ts                # Academic view models and preferences
  completeWork.ts             # Archive-first completion with rollback
  index.css                   # Local theme and responsive workspace styles
```

Pages load on demand. Completed work no longer polls a remote API. Large internship tables paginate, search is deferred, academic queues reveal rows in batches, and the semester series uses a sorted date sweep.

React Native conversion is the next phase. The data models, import parsers, and persistence interfaces are separate from the web components so they can be reused with a native storage adapter and native views. This phase remains a React web application; it does not yet include a native installer or offline app-shell packaging.