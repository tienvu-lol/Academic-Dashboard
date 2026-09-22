import { useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
import type { Day } from 'react-day-picker';
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orderedTasks, calendarLoads, isHighlighted, taskDay, text, type DashboardSettings, type Task } from '../data/planning';
import { localCalendarDate, occurrencesInRange, positionOverlappingOccurrences, type CalendarEvent, type CalendarOccurrence } from '../data/calendar';
import type { Entity } from '../data/academic';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_HEIGHT = 52;
const EVENT_COLORS: Record<CalendarEvent['type'], string> = { class: '#5D9DFC', study: '#AFA0DE', meeting: '#E6C36B', personal: '#5C946E', other: '#8B929D' };
function shift(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function timeLabel(value: string) { const [hour, minute] = value.split(':').map(Number); return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

interface PlannerProps {
  tasks: Task[];
  events: CalendarEvent[];
  courses: Entity[];
  settings: DashboardSettings;
  editTask(task: Task): void;
  addEvent(date: string, time?: string): void;
  editEvent(event: CalendarEvent): void;
}

export function Planner(props: PlannerProps) {
  const { tasks, events, courses, settings, editTask, addEvent, editEvent } = props;
  const [mode, setMode] = useState('month'), [date, setDate] = useState(new Date()), [now, setNow] = useState(new Date());
  const timeScroll = useRef<HTMLDivElement>(null);
  const scheduled = tasks.filter(task => task.due), today = localCalendarDate(now);
  const loads = calendarLoads(tasks);
  const loadFor = (day: Date) => loads[localCalendarDate(day)] ?? { pending: 0, completed: 0 };
  const heat = (day: Date) => Math.min(5, loadFor(day).pending);
  const loadClass = (day: Date) => 'workload-' + heat(day) + (loadFor(day).completed ? ' completed-load completed-load-' + Math.min(5, loadFor(day).completed) : '');
  const onDay = (day: Date) => orderedTasks(scheduled.filter(task => taskDay(task) === localCalendarDate(day)), settings).sort((a, b) => Number(a.completed) - Number(b.completed));
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  if (mode === 'week') start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: mode === 'week' ? 7 : 1 }, (_, index) => shift(start, index));
  const monthFirst = new Date(date.getFullYear(), date.getMonth(), 1, 12), monthLast = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  const rangeStart = localCalendarDate(mode === 'month' ? shift(monthFirst, -monthFirst.getDay()) : days[0]);
  const rangeEnd = localCalendarDate(mode === 'month' ? shift(monthLast, 6 - monthLast.getDay()) : days.at(-1)!);
  const visibleOccurrences = useMemo(() => occurrencesInRange(events, rangeStart, rangeEnd), [events, rangeStart, rangeEnd]);
  const eventDays = useMemo(() => {
    const result: Record<string, CalendarOccurrence[]> = {};
    for (const occurrence of visibleOccurrences) (result[occurrence.date] ??= []).push(occurrence);
    return result;
  }, [visibleOccurrences]);
  const courseFor = (event: CalendarEvent) => courses.find(course => course['fibery/id'] === event.courseId);
  const eventColor = (event: CalendarEvent) => text(courseFor(event)?.['Dashboard/Color']) || EVENT_COLORS[event.type];

  useEffect(() => {
    if (mode === 'month') return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - Date.now() % 60_000);
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
  }, [mode]);

  const viewKey = `${mode}:${localCalendarDate(date)}`;
  useEffect(() => {
    if (mode === 'month' || !days.some(day => localCalendarDate(day) === localCalendarDate(new Date()))) return;
    const frame = requestAnimationFrame(() => {
      const target = timeScroll.current;
      if (target) target.scrollTop = Math.max(0, (new Date().getHours() + new Date().getMinutes() / 60) * HOUR_HEIGHT - target.clientHeight / 2);
    });
    return () => cancelAnimationFrame(frame);
  // `viewKey` intentionally excludes the minute timer so scrolling happens only on view entry/navigation.
  }, [viewKey]);

  const move = (direction: number) => setDate(mode === 'month' ? new Date(date.getFullYear(), date.getMonth() + direction, 1) : shift(date, direction * (mode === 'week' ? 7 : 1)));
  const periodLabel = mode === 'day'
    ? date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : mode === 'week'
      ? `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${shift(start, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function taskChip(task: Task, index: number) {
    const time = task.due.includes('T') ? new Date(task.due).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'All day';
    return <Button variant="ghost" key={task.kind + task.id} className={'calendar-task ' + (task.completed ? 'calendar-task-completed ' : index === 0 ? 'first-ranked ' : '') + (isHighlighted(task, settings) ? 'important' : '')} style={{ '--task-color': task.completed ? '#5c946e' : task.color } as CSSProperties} onClick={() => editTask(task)} title={`${task.name} · ${task.priority} · ${time}`}><span className="task-color-dot" /><span><strong>{task.name}</strong><small>{task.course || task.category || task.kind}</small></span>{task.completed ? <em aria-label="Completed">✓</em> : index === 0 && <em>#1</em>}</Button>;
  }

  function eventChip(occurrence: CalendarOccurrence) {
    const course = courseFor(occurrence.event);
    return <Button variant="ghost" key={occurrence.key} className="calendar-event-chip" style={{ '--event-color': eventColor(occurrence.event) } as CSSProperties} onClick={() => editEvent(occurrence.event)} title={`${occurrence.event.title} · ${timeLabel(occurrence.startTime)}–${timeLabel(occurrence.endTime)}${occurrence.event.recurrence ? ' · Recurring series' : ''}`}><CalendarClock size={11} /><span><strong>{occurrence.event.title}</strong><small>{text(course?.['Dashboard/Code']) || occurrence.event.type}</small></span></Button>;
  }

  function dayTrack(day: Date) {
    const key = localCalendarDate(day), dayTasks = onDay(day), dayOccurrences = eventDays[key] ?? [];
    const positioned = positionOverlappingOccurrences(dayOccurrences);
    const timedTasks = dayTasks.filter(task => task.due.includes('T'));
    const current = key === today, currentMinute = now.getHours() * 60 + now.getMinutes();
    return <div className={'schedule-day-track ' + (current ? 'current-day-track' : '')} key={key} data-date={key}>
      {Array.from({ length: 24 }, (_, hour) => <button type="button" tabIndex={-1} key={hour} className="schedule-hour-slot" aria-label={`Add event on ${key} at ${String(hour).padStart(2, '0')}:00`} onClick={() => addEvent(key, `${String(hour).padStart(2, '0')}:00`)} />)}
      {timedTasks.map(task => {
        const due = new Date(task.due), minute = due.getHours() * 60 + due.getMinutes();
        return <Button key={task.kind + task.id} variant="outline" className={'calendar-due-marker ' + (task.completed ? 'is-complete' : '')} style={{ top: minute / 60 * HOUR_HEIGHT, '--task-color': task.color } as CSSProperties} onClick={() => editTask(task)} title={`${task.name} · due ${due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}><span>Due</span>{task.name}</Button>;
      })}
      {positioned.map(occurrence => {
        const course = courseFor(occurrence.event), width = 100 / occurrence.laneCount, left = occurrence.lane * width;
        return <button type="button" key={occurrence.key} className={'calendar-event-block event-type-' + occurrence.event.type} style={{ top: occurrence.startMinute / 60 * HOUR_HEIGHT, height: Math.max(18, (occurrence.endMinute - occurrence.startMinute) / 60 * HOUR_HEIGHT), left: `calc(${left}% + 3px)`, width: `calc(${width}% - 6px)`, '--event-color': eventColor(occurrence.event) } as CSSProperties} onClick={() => editEvent(occurrence.event)} title={`${occurrence.event.title} · ${timeLabel(occurrence.startTime)}–${timeLabel(occurrence.endTime)}${occurrence.event.recurrence ? ' · Edit series' : ''}`}><strong>{occurrence.event.title}</strong><span>{timeLabel(occurrence.startTime)}–{timeLabel(occurrence.endTime)}</span><small>{text(course?.['Dashboard/Code']) || occurrence.event.type}{occurrence.event.recurrence ? ' · repeats' : ''}</small></button>;
      })}
      {current && <div className="current-time-line" style={{ top: currentMinute / 60 * HOUR_HEIGHT }} aria-label={'Current time ' + now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}><span>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div>}
    </div>;
  }

  function PlannerDay({ day, modifiers, children: _children, ...cellProps }: ComponentProps<typeof Day>) {
    const value = day.date, key = localCalendarDate(value), dayTasks = onDay(value), dayEvents = eventDays[key] ?? [], load = loadFor(value);
    const shownEvents = dayEvents.slice(0, 2), remainingSlots = Math.max(0, 3 - shownEvents.length), shownTasks = dayTasks.slice(0, remainingSlots);
    const hidden = dayTasks.length + dayEvents.length - shownTasks.length - shownEvents.length;
    return <td {...cellProps} className={'planner-day ' + loadClass(value) + (modifiers.outside ? ' outside-month' : '')} data-date={key} aria-label={`${key}, ${load.pending} pending assignments, ${dayEvents.length} scheduled events`}>
      <div className="day-header"><Button variant="ghost" size="icon-sm" className={'day-number ' + (key === today ? 'today' : '')} aria-label={'View ' + key} onClick={() => { setDate(value); setMode('day'); }}>{value.getDate()}</Button>{load.pending > 0 && <Badge variant="outline" className="day-load" title={`${load.pending} pending assignments`}>{load.pending}</Badge>}{load.completed > 0 && <Badge variant="outline" className="day-load day-load-completed" title={`${load.completed} completed assignments`}>✓{load.completed}</Badge>}<Button variant="ghost" size="icon-sm" aria-label={'Add event on ' + key} className="day-add" onClick={() => addEvent(key)}><Plus size={12} /></Button></div>
      {shownEvents.map(eventChip)}{shownTasks.map((task, index) => taskChip(task, index))}
      {hidden > 0 && <Button variant="ghost" size="sm" className="more-events" onClick={() => { setDate(value); setMode('day'); }}>+{hidden} more</Button>}
    </td>;
  }

  return <Card className="panel planner">
    <div className="section-heading"><h2><CalendarDays size={17} />Schedule</h2><div className="schedule-heading-actions"><Tabs value={mode} onValueChange={setMode}><TabsList aria-label="Schedule view">{['month', 'week', 'day'].map(value => <TabsTrigger value={value} key={value}>{value}</TabsTrigger>)}</TabsList></Tabs><Button size="sm" onClick={() => addEvent(localCalendarDate(date))}><Plus />Add event</Button></div></div>
    <div className="calendar-toolbar"><h3>{periodLabel}</h3><div className="toolbar-actions"><Button size="sm" variant="ghost" onClick={() => setDate(new Date())}>Today</Button><Button size="icon-sm" variant="outline" aria-label="Previous period" onClick={() => move(-1)}><ChevronLeft /></Button><Button size="icon-sm" variant="outline" aria-label="Next period" onClick={() => move(1)}><ChevronRight /></Button></div></div>
    {mode === 'month' ? <Calendar className="full-calendar" month={date} onMonthChange={setDate} hideNavigation showOutsideDays components={{ Day: PlannerDay }} /> : <div className="time-scroll" ref={timeScroll}><div className="schedule-time-grid" style={{ '--days': days.length } as CSSProperties}>
      <div className="schedule-corner">Local time</div>{days.map(day => { const key = localCalendarDate(day), current = key === today; return <Button variant="ghost" className={'time-day-heading ' + loadClass(day) + (current ? ' current-day-heading' : '')} key={key} onClick={() => { setDate(day); setMode('day'); }}><span>{dayNames[day.getDay()]} <b>{day.getDate()}</b></span>{current && <small>Today</small>}{heat(day) > 0 && <small>{loadFor(day).pending} due</small>}</Button>; })}
      <div className="schedule-corner schedule-due-label">Due</div>{days.map(day => { const allDay = onDay(day).filter(task => !task.due.includes('T')); return <div className="all-day-cell" key={localCalendarDate(day)}>{allDay.length ? allDay.map((task, index) => taskChip(task, index)) : <span className="empty-due">—</span>}</div>; })}
      <div className="schedule-time-axis">{Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ top: hour * HOUR_HEIGHT }}>{String(hour).padStart(2, '0')}:00</span>)}</div>{days.map(dayTrack)}
    </div></div>}
    <div className="calendar-footnote"><span>Workload</span><span>0</span><div className="workload-legend">{[0, 1, 2, 3, 4, 5].map(level => <i key={level} className={'workload-' + level} title={level === 5 ? '5+ pending assignments' : `${level} pending assignments`} />)}</div><span>5+</span><span className="calendar-kind-key"><i className="event-key" />Events <i className="task-key" />Task due dates</span></div>
  </Card>;
}
