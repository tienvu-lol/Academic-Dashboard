export const CALENDAR_EVENT_TYPES = ['class', 'study', 'meeting', 'personal', 'other'] as const;
export type CalendarEventType = typeof CALENDAR_EVENT_TYPES[number];
export type CalendarWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeeklyRecurrence {
  kind: 'weekly';
  weekdays: CalendarWeekday[];
  startDate: string;
  endDate: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  courseId: string;
  type: CalendarEventType;
  date: string;
  startTime: string;
  endTime: string;
  recurrence?: WeeklyRecurrence;
}

export interface CalendarOccurrence {
  key: string;
  eventId: string;
  date: string;
  startTime: string;
  endTime: string;
  startMinute: number;
  endMinute: number;
  event: CalendarEvent;
}

export interface PositionedOccurrence extends CalendarOccurrence {
  lane: number;
  laneCount: number;
}

type DateParts = { year: number; month: number; day: number };

function dateParts(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return null;
  return { year, month, day };
}

export function isCalendarDate(value: unknown): value is string {
  return typeof value === 'string' && dateParts(value) !== null;
}

export function localCalendarDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function calendarDate(value: string): Date {
  const parts = dateParts(value);
  if (!parts) throw new Error(`Invalid calendar date: ${value}`);
  return new Date(parts.year, parts.month - 1, parts.day, 12);
}

export function addCalendarDays(value: string, days: number): string {
  const date = calendarDate(value);
  date.setDate(date.getDate() + days);
  return localCalendarDate(date);
}

export function calendarWeekday(value: string): CalendarWeekday {
  return calendarDate(value).getDay() as CalendarWeekday;
}

export function timeMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return -1;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : -1;
}

export function eventValidationErrors(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Event data is invalid.'];
  const event = value as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof event.id !== 'string' || !event.id.trim()) errors.push('Event ID is required.');
  if (typeof event.title !== 'string' || !event.title.trim()) errors.push('Title is required.');
  if (typeof event.courseId !== 'string') errors.push('Course association is invalid.');
  if (typeof event.type !== 'string' || !(CALENDAR_EVENT_TYPES as readonly string[]).includes(event.type)) errors.push('Choose a valid event type.');
  if (!isCalendarDate(event.date)) errors.push('Choose a valid event date.');
  const start = typeof event.startTime === 'string' ? timeMinutes(event.startTime) : -1;
  const end = typeof event.endTime === 'string' ? timeMinutes(event.endTime) : -1;
  if (start < 0) errors.push('Choose a valid start time.');
  if (end < 0) errors.push('Choose a valid end time.');
  if (start >= 0 && end >= 0 && end <= start) errors.push('End time must be after start time.');

  if (event.recurrence !== undefined) {
    if (!event.recurrence || typeof event.recurrence !== 'object' || Array.isArray(event.recurrence)) errors.push('Recurrence rule is invalid.');
    else {
      const recurrence = event.recurrence as Record<string, unknown>;
      if (recurrence.kind !== 'weekly') errors.push('Only weekly recurrence is supported.');
      if (!Array.isArray(recurrence.weekdays) || recurrence.weekdays.length === 0) errors.push('Choose at least one weekday.');
      else {
        const weekdays = recurrence.weekdays;
        if (weekdays.some(day => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6)) errors.push('Recurrence weekdays are invalid.');
        if (new Set(weekdays).size !== weekdays.length) errors.push('Recurrence weekdays must be unique.');
      }
      if (!isCalendarDate(recurrence.startDate)) errors.push('Choose a valid recurrence start date.');
      if (!isCalendarDate(recurrence.endDate)) errors.push('Choose a valid recurrence end date.');
      if (isCalendarDate(recurrence.startDate) && isCalendarDate(recurrence.endDate) && recurrence.endDate < recurrence.startDate) errors.push('Recurrence end date must be on or after its start date.');
      if (isCalendarDate(event.date) && isCalendarDate(recurrence.startDate) && event.date !== recurrence.startDate) errors.push('Event date must match the recurrence start date.');
    }
  }
  return errors;
}

export function validateCalendarEvents(value: unknown): asserts value is CalendarEvent[] {
  if (!Array.isArray(value)) throw new Error('Calendar events must be a list.');
  const ids = new Set<string>();
  for (const event of value) {
    const errors = eventValidationErrors(event);
    if (errors.length) throw new Error(errors[0]);
    const id = (event as CalendarEvent).id;
    if (ids.has(id)) throw new Error('Calendar event IDs must be unique.');
    ids.add(id);
  }
}

export function eventsFor(workspace: { calendarEvents?: CalendarEvent[] }): CalendarEvent[] {
  return workspace.calendarEvents ?? [];
}

export function occurrencesInRange(events: CalendarEvent[], rangeStart: string, rangeEnd: string): CalendarOccurrence[] {
  if (!isCalendarDate(rangeStart) || !isCalendarDate(rangeEnd) || rangeEnd < rangeStart) throw new Error('Choose a valid calendar range.');
  const occurrences: CalendarOccurrence[] = [];
  const append = (event: CalendarEvent, date: string) => {
    occurrences.push({ key: `${event.id}:${date}`, eventId: event.id, date, startTime: event.startTime, endTime: event.endTime, startMinute: timeMinutes(event.startTime), endMinute: timeMinutes(event.endTime), event });
  };
  for (const event of events) {
    if (eventValidationErrors(event).length) continue;
    if (!event.recurrence) {
      if (event.date >= rangeStart && event.date <= rangeEnd) append(event, event.date);
      continue;
    }
    const start = event.recurrence.startDate > rangeStart ? event.recurrence.startDate : rangeStart;
    const end = event.recurrence.endDate < rangeEnd ? event.recurrence.endDate : rangeEnd;
    if (start > end) continue;
    const weekdays = new Set(event.recurrence.weekdays);
    for (let date = start; date <= end; date = addCalendarDays(date, 1)) if (weekdays.has(calendarWeekday(date))) append(event, date);
  }
  return occurrences.sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute || a.endMinute - b.endMinute || a.event.title.localeCompare(b.event.title));
}

export function positionOverlappingOccurrences(occurrences: CalendarOccurrence[]): PositionedOccurrence[] {
  const sorted = [...occurrences].sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute || a.key.localeCompare(b.key));
  const result: PositionedOccurrence[] = [];
  let group: CalendarOccurrence[] = [], groupEnd = -1;
  const flush = () => {
    if (!group.length) return;
    const laneEnds: number[] = [];
    const placements = group.map(occurrence => {
      let lane = laneEnds.findIndex(end => end <= occurrence.startMinute);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = occurrence.endMinute;
      return { ...occurrence, lane, laneCount: 0 };
    });
    const laneCount = laneEnds.length;
    result.push(...placements.map(occurrence => ({ ...occurrence, laneCount })));
    group = [];
  };
  for (const occurrence of sorted) {
    if (group.length && occurrence.startMinute >= groupEnd) flush();
    group.push(occurrence);
    groupEnd = group.length === 1 ? occurrence.endMinute : Math.max(groupEnd, occurrence.endMinute);
  }
  flush();
  return result;
}
