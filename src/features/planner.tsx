import { useState, type ComponentProps, type CSSProperties } from 'react';
import type { Day } from 'react-day-picker';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orderedTasks, calendarLoads, isHighlighted, taskDay, type DashboardSettings, type Task } from '../data/planning';
import { todayLocal } from '../internships/model';

const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function shift(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
export function Planner({ tasks, settings, edit, add }: { tasks: Task[]; settings: DashboardSettings; edit(task: Task): void; add(date: string): void }) {
  const [mode, setMode] = useState('month'), [date, setDate] = useState(new Date());
  const scheduled = tasks.filter(x => x.due), today = todayLocal();
  const onDay = (day: Date) => orderedTasks(scheduled.filter(x => taskDay(x) === todayLocal(day)), settings).sort((a, b) => Number(a.completed) - Number(b.completed));
  const loads = calendarLoads(tasks);
  const loadFor = (day: Date) => loads[todayLocal(day)] ?? { pending: 0, completed: 0 };
  const heat = (day: Date) => Math.min(5, loadFor(day).pending);
  const loadClass = (day: Date) => 'workload-' + heat(day) + (loadFor(day).completed ? ' completed-load completed-load-' + Math.min(5, loadFor(day).completed) : '');
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (mode === 'week') start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: mode === 'week' ? 7 : 1 }, (_, i) => shift(start, i));
  const move = (direction: number) => setDate(mode === 'month' ? new Date(date.getFullYear(), date.getMonth() + direction, 1) : shift(date, direction * (mode === 'week' ? 7 : 1)));
  function chip(task: Task, index: number) {
    const time = task.due.includes('T') ? new Date(task.due).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'All day';
    return <Button variant="ghost" key={task.kind + task.id} className={'calendar-task ' + (task.completed ? 'calendar-task-completed ' : index === 0 ? 'first-ranked ' : '') + (isHighlighted(task, settings) ? 'important' : '')} style={{ '--task-color': task.completed ? '#5c946e' : task.color } as CSSProperties} onClick={() => edit(task)} title={task.name + (task.completed ? ' · Completed' : '') + ' · ' + task.priority + ' · ' + time}><span className="task-color-dot" /><span><strong>{task.name}</strong><small>{task.course || task.category || task.kind}{mode !== 'month' && ' · ' + time}{mode !== 'month' && task.end && ' – ' + new Date(task.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></span>{task.completed ? <em aria-label="Completed">✓</em> : index === 0 && <em>#1</em>}</Button>;
  }
  function PlannerDay({ day, modifiers, children: _children, ...props }: ComponentProps<typeof Day>) {
    const value = day.date, key = todayLocal(value), items = onDay(value), load = loadFor(value), count = load.pending;
    return <td {...props} className={'planner-day ' + loadClass(value) + (modifiers.outside ? ' outside-month' : '')} data-date={key} aria-label={key + ', ' + count + ' pending assignments, ' + load.completed + ' completed assignments'}><div className="day-header"><Button variant="ghost" size="icon-sm" className={'day-number ' + (key === today ? 'today' : '')} aria-label={'View ' + key} onClick={() => { setDate(value); setMode('day'); }}>{value.getDate()}</Button>{count > 0 && <Badge variant="outline" className="day-load" title={count + ' pending assignments'}>{count}</Badge>}{load.completed > 0 && <Badge variant="outline" className="day-load day-load-completed" title={load.completed + ' completed assignments'}>✓{load.completed}</Badge>}<Button variant="ghost" size="icon-sm" aria-label={'Add task on ' + key} className="day-add" onClick={() => add(key)}><Plus size={12} /></Button></div>{items.slice(0, 3).map(chip)}{items.length > 3 && <Button variant="ghost" size="sm" className="more-events" onClick={() => { setDate(value); setMode('day'); }}>+{items.length - 3} more</Button>}</td>;
  }
  return <Card className="panel planner"><div className="section-heading"><h2><CalendarDays size={17} />Your calendar</h2><Tabs value={mode} onValueChange={setMode}><TabsList aria-label="Calendar view">{['month', 'week', 'day'].map(x => <TabsTrigger value={x} key={x}>{x}</TabsTrigger>)}</TabsList></Tabs></div><div className="calendar-toolbar"><h3>{mode === 'day' ? date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><div className="toolbar-actions"><Button size="sm" variant="ghost" onClick={() => setDate(new Date())}>Today</Button><Button size="icon-sm" variant="outline" aria-label="Previous period" onClick={() => move(-1)}><ChevronLeft /></Button><Button size="icon-sm" variant="outline" aria-label="Next period" onClick={() => move(1)}><ChevronRight /></Button></div></div>
    {mode === 'month' ? <Calendar className="full-calendar" month={date} onMonthChange={setDate} fixedWeeks hideNavigation showOutsideDays components={{ Day: PlannerDay }} /> : <div className="time-scroll"><div className="time-grid" style={{ '--days': days.length } as CSSProperties}><div className="time-gutter">Local time</div>{days.map(day => <Button variant="ghost" className={'time-day-heading ' + loadClass(day) + (todayLocal(day) === today ? ' text-blue' : '')} key={todayLocal(day)} onClick={() => add(todayLocal(day))}>{names[day.getDay()]} <b>{day.getDate()}</b>{heat(day) > 0 && <span>{loadFor(day).pending} due</span>}{loadFor(day).completed > 0 && <span className="text-green">✓{loadFor(day).completed}</span>}<Plus size={12} /></Button>)}<div className="time-gutter">All day</div>{days.map(day => <div className="all-day-cell" key={todayLocal(day)}>{onDay(day).filter(t => !t.due.includes('T')).map(t => chip(t, onDay(day).indexOf(t)))}</div>)}{Array.from({ length: 24 }, (_, hour) => <div className="time-row" key={hour}><div className="time-gutter">{String(hour).padStart(2, '0')}:00</div>{days.map(day => { const items = onDay(day); return <div className="time-cell" key={todayLocal(day)}>{items.filter(t => t.due.includes('T') && new Date(t.due).getHours() === hour).map(t => chip(t, items.indexOf(t)))}</div>; })}</div>)}</div></div>}
    <div className="calendar-footnote"><span>Pending assignments</span><div className="workload-legend">{[0, 1, 2, 3, 4, 5].map(n => <i key={n} className={'workload-' + n} title={n === 5 ? '5+ assignments' : n + ' assignments'} />)}</div><span>0 → 5+ · green = completed · mixed days keep pending load red · outlined #1 active priority</span></div>
  </Card>;
}
