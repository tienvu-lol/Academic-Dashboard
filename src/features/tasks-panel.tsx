import { useRef, useState } from 'react';
import { GripVertical, Check, Pencil, Trash2, Search, Tags, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { manuallyOrderedTasks, taskKey, reorderIds, settingsFor, setTaskCompleted, isHighlighted, dueTime, type Task } from '../data/planning';
import type { Workspace } from '../platform/workspace';
import type { Change } from './forms';

function taskDueLabel(task: Task) {
  if (!task.due) return 'Unscheduled';
  const due = new Date(task.due.includes('T') ? task.due : task.due + 'T12:00:00');
  return due.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: due.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export function TasksPanel({ workspace, tasks, change, prioritize, busy, edit, remove, categories }: { workspace: Workspace; tasks: Task[]; change: Change; prioritize?: () => Promise<boolean>; busy: boolean; edit(task?: Task): void; remove(task: Task): void; categories(): void }) {
  const [open, setOpen] = useState(true), [query, setQuery] = useState(''), [filter, setFilter] = useState('Active');
  const [category, setCategory] = useState(''), [over, setOver] = useState(''), [announcement, setAnnouncement] = useState('');
  const dragged = useRef('');
  const setDragging = (value: string) => { dragged.current = value; };
  const settings = settingsFor(workspace), ordered = manuallyOrderedTasks(tasks, settings);
  const shown = ordered.filter(t => (!category || t.categoryId === category) && (filter === 'All' || (filter === 'Completed' ? t.completed : !t.completed && (filter === 'Active' || t.kind === filter))) && [t.name, t.course, t.category].join(' ').toLowerCase().includes(query.toLowerCase()));

  const displayTasks = open ? shown : shown.slice(0, 4);

  async function move(from: string, to: string) {
    if (!from || from === to) return;
    const ok = await change(draft => { draft.dashboardSettings = { ...settingsFor(draft), taskOrder: reorderIds(ordered.map(taskKey), from, to) }; });
    if (ok) setAnnouncement('Task order saved.');
    setDragging(''); setOver('');
  }

  return <Card className="panel tasks-panel">
    <div className="section-heading">
      <h2><Button variant="ghost" className="heading-toggle" onClick={() => setOpen(!open)}>{open ? <ChevronDown /> : <ChevronRight />}Tasks <Badge variant="secondary">{tasks.length}</Badge></Button></h2>
      <div className="toolbar-actions">
        {prioritize && <Button variant="ghost" size="sm" title="AI Auto-Prioritize Tasks" disabled={busy} onClick={() => { setAnnouncement('Running AI Prioritization...'); void prioritize().then(ok => setAnnouncement(ok ? 'AI Prioritization complete.' : 'AI Prioritization failed.')); }}>✨ Auto-Prioritize</Button>}
        {!!settings.taskOrder?.length && <Button variant="ghost" size="sm" title="Restore automatic priority order" onClick={() => void change(draft => { draft.dashboardSettings = { ...settingsFor(draft), taskOrder: [] }; })}><RotateCcw />Use priority order</Button>}
        <Button variant="ghost" size="sm" onClick={categories}><Tags />Categories</Button>
      </div>
    </div>

    {open && (
      <div className="list-toolbar task-toolbar">
        <div className="search-field"><Search size={14} /><Input aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <div className="task-filter-group">
          <div className="filter-tabs" aria-label="Filter tasks by status">{['Active', 'Assignment', 'To-Do', 'Completed', 'All'].map(x => <Button size="sm" variant="ghost" key={x} aria-pressed={filter === x} onClick={() => setFilter(x)}>{x === 'Assignment' ? 'Assignments' : x === 'To-Do' ? 'To-Dos' : x}</Button>)}</div>
          <select aria-label="Filter tasks by category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{workspace.academic.options['University/Category'].map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </div>
      </div>
    )}

    <Table className="dense-task-table task-table"><TableHeader><TableRow><TableHead className="grip-cell"><span className="sr-only">Reorder</span></TableHead><TableHead>Task / course</TableHead><TableHead>Priority</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{displayTasks.map((task, index) => {
      const overdue = !task.completed && dueTime(task) < Date.now();
      return <TableRow key={taskKey(task)} className={(task.completed ? 'task-completed ' : '') + (over === taskKey(task) ? 'drop-target' : '')} onDragOver={e => { if (dragged.current) { e.preventDefault(); setOver(taskKey(task)); } }} onDrop={e => { e.preventDefault(); if (dragged.current) void move(dragged.current, taskKey(task)); }}>
        <TableCell className="grip-cell"><Button variant="ghost" size="icon-sm" className="drag-grip" draggable={!busy} disabled={busy} aria-label={'Reorder ' + task.name} title="Drag to reorder. Use Alt + Up/Down on this handle." onDragStart={e => { setDragging(taskKey(task)); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', taskKey(task)); }} onDragEnd={() => { setDragging(''); setOver(''); }} onKeyDown={e => { if (e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const target = shown[index + (e.key === 'ArrowUp' ? -1 : 1)]; if (target) void move(taskKey(task), taskKey(target)); } }}><GripVertical size={14} /></Button></TableCell>
        <TableCell><div className="task-title"><Checkbox aria-label={(task.completed ? 'Reopen ' : 'Complete ') + task.name} checked={task.completed} disabled={busy} onCheckedChange={value => void change(draft => setTaskCompleted(draft, task, value === true))} /><button className="task-name-button" onClick={() => edit(task)}><span className={isHighlighted(task, settings) ? 'important' : ''}>{task.name}</span><small><i style={{ background: task.color }} />{task.course || task.category || task.kind}<span className="kind-label">{task.kind}</span></small></button></div></TableCell>
        <TableCell><Badge variant="outline" className={'priority-pill priority-' + task.priority.toLowerCase()}>{task.priority}</Badge></TableCell>
        <TableCell className={'due-label ' + (overdue ? 'text-red' : '')}>{overdue && <span className="due-status">Overdue</span>}<span>{taskDueLabel(task)}</span></TableCell>
        <TableCell><div className="row-actions justify-end"><Button variant="ghost" size="icon-sm" title={'Edit ' + task.name} aria-label={'Edit ' + task.name} onClick={() => edit(task)}><Pencil /></Button><Button variant="ghost" size="icon-sm" title={'Delete ' + task.name} aria-label={'Delete ' + task.name} onClick={() => remove(task)}><Trash2 /></Button></div></TableCell>
      </TableRow>;
    })}</TableBody></Table>
    {!shown.length && <div className="empty-small compact-empty"><Check size={16} />{tasks.length ? 'No tasks match these filters.' : 'No tasks yet. Use Add task to create one.'}</div>}

    {open ? (
      <div className="task-list-footer"><span>{shown.length} shown • Drag or use Alt + ↑/↓ to reorder</span></div>
    ) : (
      shown.length > 4 && <div className="task-list-footer" style={{ justifyContent: 'center' }}><Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Show {shown.length - 4} more active tasks</Button></div>
    )}

    <span className="sr-only" role="status">{announcement}</span>
  </Card>;
}
