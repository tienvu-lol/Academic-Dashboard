# Calendar Specification
## Academic Dashboard — Native-Overhaul Branch

## Product Boundary

The Schedule widget combines two distinct concepts without conflating their data:

- **Tasks** are assignments and to-dos with optional due dates. They remain owned by the academic task model and may be completed, prioritized, and ranked.
- **Calendar events** are scheduled blocks of time. They are owned by the calendar domain and may be one-time events or weekly recurring series.

Creating an event must never create a fake assignment or to-do. Event series are persisted once and expanded into virtual occurrences only for the date range being rendered.

## Event Model

```ts
type CalendarEventType = 'class' | 'study' | 'meeting' | 'personal' | 'other';
type CalendarWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface WeeklyRecurrence {
  kind: 'weekly';
  weekdays: CalendarWeekday[];
  startDate: string; // local YYYY-MM-DD, inclusive
  endDate: string;   // local YYYY-MM-DD, inclusive
}

interface CalendarEvent {
  id: string;
  title: string;
  courseId: string; // optional association; empty string means none
  type: CalendarEventType;
  date: string;      // one-time date or series anchor, local YYYY-MM-DD
  startTime: string; // local HH:mm
  endTime: string;   // local HH:mm; must be later on the same day
  recurrence?: WeeklyRecurrence;
}
```

Required validation:

- ID and trimmed title are non-empty.
- Type is one of the documented event types.
- Date strings are real local calendar dates in `YYYY-MM-DD` form.
- Time strings use 24-hour `HH:mm` form and end is after start.
- A weekly rule has at least one unique weekday and an inclusive end date on or after its start date.
- The event `date` equals the recurrence start date for a recurring series.
- Event IDs are unique in a workspace.

Midnight-crossing events, per-occurrence overrides, custom intervals, and recurrence exceptions are outside the MVP. Editing or deleting any occurrence edits or deletes the entire series, and the interface must say so.

## Persistence

SQLite stores one row per event or recurring series in `calendar_events`. The serialized payload is authoritative; indexed start/end date columns support future range queries. The workspace remains version 2 and older databases load with an empty event list.

The renderer continues to use the existing whole-workspace preload bridge. It receives no database, filesystem, or network capability.

## Recurrence Expansion

`occurrencesInRange(events, rangeStart, rangeEnd)` is pure calendar-domain logic:

- It accepts inclusive local date boundaries.
- A one-time event is returned only when its date is inside the range.
- A recurring series is clipped to the intersection of its rule and visible range.
- An occurrence is emitted when the local weekday is selected.
- The final recurrence date is included when it is a selected weekday.
- No occurrences are written back to the workspace or database.

All date iteration uses local calendar parts or date-only helpers. Date-only event values must not be interpreted as UTC midnight.

## Editor Behavior

The dedicated event editor includes title, optional course association, event type, date, start/end time, a weekly repeat toggle, weekday buttons, and a recurrence end date. It reports validation errors in an accessible live alert and keeps the user’s values after a save error.

Time-cell creation prefills date/start time and a one-hour end time. Day-level creation prefills the date and a sensible next-hour interval.

## View Behavior

### Month

- Retains assignment workload heat and completed-activity cues.
- Shows compact task due chips and compact, visually distinct event-presence chips.
- Avoids rendering detailed durations or a miniature timetable.
- Clicking the day number opens that day view; its add affordance creates an event for that date.

### Week and Day

- Render a 24-hour grid with a readable time gutter.
- Show all-day task due dates in a separate due row.
- Show timed task deadlines as compact **Due** markers, not duration blocks.
- Position calendar-event blocks by their exact start time and size them by duration.
- Place overlapping event blocks in side-by-side lanes.
- Emphasize today’s heading/column without using color alone.
- Clicking a day heading opens day view; clicking an empty time cell creates an event at that date/hour.

### Current Time

- Appears only in today’s week/day column.
- Uses the current local time to calculate vertical position and includes a readable time label.
- Updates at the next minute boundary and then approximately every minute.
- Initial entry/navigation to a view containing today may scroll the current time near the center once. Timer updates must not keep moving the user’s scroll position.

## Navigation

- Previous/next moves one month, seven days, or one day according to mode.
- Today returns to the current date in every mode.
- Clicking a month day number or week day heading opens day mode for that date.

## Verification Contract

Automated coverage must include M/W/F, T/Th, single-weekday recurrence, boundaries/final day, local-date stability, invalid time/rules, SQLite reopen persistence, workspace uniqueness, and course-removal behavior. The Electron flow must exercise one-time persistence, recurring creation, visible occurrences, whole-series edit/delete, all views, and the current-time line.
