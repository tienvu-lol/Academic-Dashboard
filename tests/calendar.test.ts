import { expect, test } from 'bun:test';
import { calendarDate, eventValidationErrors, occurrencesInRange, positionOverlappingOccurrences, validateCalendarEvents, type CalendarEvent, type CalendarWeekday } from '../src/data/calendar';

function weekly(weekdays: CalendarWeekday[], endDate = '2026-09-30'): CalendarEvent {
  return { id: 'series', title: 'CS class', courseId: 'cs', type: 'class', date: '2026-09-01', startTime: '09:30', endTime: '10:45', recurrence: { kind: 'weekly', weekdays, startDate: '2026-09-01', endDate } };
}

test('weekly recurrence expands M/W/F, T/Th, and one weekday inside the visible range', () => {
  expect(occurrencesInRange([weekly([1, 3, 5])], '2026-09-06', '2026-09-12').map(x => x.date)).toEqual(['2026-09-07', '2026-09-09', '2026-09-11']);
  expect(occurrencesInRange([weekly([2, 4])], '2026-09-06', '2026-09-12').map(x => x.date)).toEqual(['2026-09-08', '2026-09-10']);
  expect(occurrencesInRange([weekly([0])], '2026-09-06', '2026-09-19').map(x => x.date)).toEqual(['2026-09-06', '2026-09-13']);
});

test('weekly recurrence excludes dates outside its rule and includes a valid final day', () => {
  const event = weekly([2, 4], '2026-09-10');
  expect(occurrencesInRange([event], '2026-08-25', '2026-09-20').map(x => x.date)).toEqual(['2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10']);
  expect(occurrencesInRange([event], '2026-08-01', '2026-08-31')).toEqual([]);
  expect(occurrencesInRange([event], '2026-09-11', '2026-09-30')).toEqual([]);
});

test('date-only calendar values retain their local calendar day', () => {
  const date = calendarDate('2026-03-08');
  expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 3, 8]);
  const oneTime: CalendarEvent = { id: 'one', title: 'Office hours', courseId: '', type: 'meeting', date: '2026-03-08', startTime: '14:00', endTime: '15:00' };
  expect(occurrencesInRange([oneTime], '2026-03-08', '2026-03-08')[0].date).toBe('2026-03-08');
});

test('event validation rejects end-before-start and invalid weekly ranges', () => {
  expect(eventValidationErrors({ ...weekly([1]), startTime: '11:00', endTime: '10:00' })).toContain('End time must be after start time.');
  expect(eventValidationErrors(weekly([], '2026-08-31'))).toContain('Choose at least one weekday.');
  expect(eventValidationErrors(weekly([2], '2026-08-31'))).toContain('Recurrence end date must be on or after its start date.');
  expect(() => validateCalendarEvents([weekly([1]), { ...weekly([3]), title: 'Duplicate' }])).toThrow('unique');
});

test('overlapping occurrences receive side-by-side lanes while touching events can reuse a lane', () => {
  const events: CalendarEvent[] = [
    { id: 'a', title: 'A', courseId: '', type: 'study', date: '2026-09-20', startTime: '09:00', endTime: '10:00' },
    { id: 'b', title: 'B', courseId: '', type: 'meeting', date: '2026-09-20', startTime: '09:30', endTime: '10:30' },
    { id: 'c', title: 'C', courseId: '', type: 'personal', date: '2026-09-20', startTime: '10:00', endTime: '11:00' },
  ];
  const positioned = positionOverlappingOccurrences(occurrencesInRange(events, '2026-09-20', '2026-09-20'));
  expect(positioned.map(x => [x.eventId, x.lane, x.laneCount])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 0, 2]]);
});
