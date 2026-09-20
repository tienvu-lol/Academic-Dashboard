import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addCalendarDays, calendarWeekday, CALENDAR_EVENT_TYPES, eventValidationErrors, type CalendarEvent, type CalendarEventType, type CalendarWeekday } from '../data/calendar';
import { coursesFor, text } from '../data/planning';
import { todayLocal } from '../internships/model';
import type { Workspace } from '../platform/workspace';
import { DateField, Field, Modal, type Change } from './forms';

const weekdays: Array<{ value: CalendarWeekday; label: string }> = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 0, label: 'Sun' },
];

function defaultTimes(initialTime?: string) {
  if (initialTime) {
    const hour = Number(initialTime.slice(0, 2));
    return [initialTime, hour >= 23 ? '23:59' : `${String(hour + 1).padStart(2, '0')}:${initialTime.slice(3, 5)}`];
  }
  const now = new Date(), hour = Math.min(22, now.getMinutes() ? now.getHours() + 1 : now.getHours());
  return [`${String(hour).padStart(2, '0')}:00`, `${String(hour + 1).padStart(2, '0')}:00`];
}

export function CalendarEventEditor({ workspace, event, initialDate, initialTime, change, close, remove }: {
  workspace: Workspace; event?: CalendarEvent; initialDate?: string; initialTime?: string;
  change: Change; close(): void; remove?(): void;
}) {
  const [defaultStart, defaultEnd] = defaultTimes(initialTime);
  const initialDay = event?.date ?? initialDate ?? todayLocal();
  const [title, setTitle] = useState(event?.title ?? '');
  const [courseId, setCourseId] = useState(event?.courseId ?? '');
  const [type, setType] = useState<CalendarEventType>(event?.type ?? 'class');
  const [date, setDate] = useState(initialDay);
  const [startTime, setStartTime] = useState(event?.startTime ?? defaultStart);
  const [endTime, setEndTime] = useState(event?.endTime ?? defaultEnd);
  const [repeats, setRepeats] = useState(Boolean(event?.recurrence));
  const [selectedDays, setSelectedDays] = useState<CalendarWeekday[]>(event?.recurrence?.weekdays ?? [calendarWeekday(initialDay)]);
  const [recurrenceEnd, setRecurrenceEnd] = useState(event?.recurrence?.endDate ?? addCalendarDays(initialDay, 112));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleDay = (day: CalendarWeekday) => setSelectedDays(days => days.includes(day) ? days.filter(value => value !== day) : [...days, day]);
  async function save() {
    const row: CalendarEvent = {
      id: event?.id ?? crypto.randomUUID(), title: title.trim(), courseId, type, date, startTime, endTime,
      ...(repeats ? { recurrence: { kind: 'weekly' as const, weekdays: [...selectedDays].sort() as CalendarWeekday[], startDate: date, endDate: recurrenceEnd } } : {}),
    };
    const errors = eventValidationErrors(row);
    if (errors.length) { setError(errors[0]); return; }
    setSaving(true);
    const saved = await change(draft => { draft.calendarEvents = [...(draft.calendarEvents ?? []).filter(item => item.id !== row.id), row]; });
    setSaving(false);
    if (saved) close();
    else setError('Could not save this event. Your changes remain here; see the workspace error for details.');
  }

  return <Modal title={event ? 'Edit event' : 'Add an event'} description={repeats || event?.recurrence ? 'Recurring changes apply to the whole series.' : 'Block focused time without creating a task.'} close={close}>
    <form className="editor-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      <Field label="Title"><Input autoFocus required value={title} placeholder="e.g. Algorithms lecture" onChange={e => setTitle(e.target.value)} /></Field>
      <div className="form-grid">
        <Field label="Type"><select value={type} onChange={e => setType(e.target.value as CalendarEventType)}>{CALENDAR_EVENT_TYPES.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></Field>
        <Field label="Course (optional)"><select value={courseId} onChange={e => setCourseId(e.target.value)}><option value="">No course</option>{coursesFor(workspace).map(course => <option value={course['fibery/id']} key={course['fibery/id']}>{text(course['Dashboard/Code']) || course['University/Name']} · {course['University/Name']}</option>)}</select></Field>
      </div>
      <div className="form-grid"><DateField label={repeats ? 'Series starts' : 'Date'} value={date} onChange={value => { setDate(value); if (!selectedDays.length && value) setSelectedDays([calendarWeekday(value)]); }} /><Field label="Start time"><Input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} /></Field><Field label="End time"><Input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} /></Field></div>
      <label className="check-label"><input type="checkbox" checked={repeats} onChange={e => { setRepeats(e.target.checked); if (e.target.checked && !selectedDays.length && date) setSelectedDays([calendarWeekday(date)]); }} /> Repeat weekly</label>
      {repeats && <div className="recurrence-fields"><fieldset><legend>Repeats on</legend><div className="weekday-picker">{weekdays.map(day => <Button key={day.value} type="button" size="sm" variant={selectedDays.includes(day.value) ? 'secondary' : 'outline'} aria-pressed={selectedDays.includes(day.value)} onClick={() => toggleDay(day.value)}>{day.label}</Button>)}</div></fieldset><DateField label="Series ends" value={recurrenceEnd} onChange={setRecurrenceEnd} /><p className="muted text-xs">Every selected weekday through the end date. Individual occurrence exceptions are not part of this version.</p></div>}
      {error && <p role="alert" aria-live="polite" className="error-text">{error}</p>}
      <div className="form-actions form-actions-split">{event && remove ? <Button type="button" variant="ghost" className="danger-ghost" onClick={remove}><Trash2 />Delete {event.recurrence ? 'series' : 'event'}</Button> : <span />}<div><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : event ? 'Save changes' : 'Add event'}</Button></div></div>
    </form>
  </Modal>;
}
