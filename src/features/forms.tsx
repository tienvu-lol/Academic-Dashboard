import { useState, type ReactNode } from 'react';
import { CalendarDays, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { collectionFor, coursesFor, palette, text, type Task, type TaskKind } from '../data/planning';
import type { Workspace } from '../platform/workspace';
import type { Entity } from '../data/academic';
import { createInternship, todayLocal, validateInternship, type Internship } from '../internships/model';

export type Change = (update: (draft: Workspace) => void) => Promise<boolean>;
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
export function Modal({ title, description, children, close }: { title: string; description: string; children: ReactNode; close(): void }) {
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="editor-dialog"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>;
}
export function DateField({ value, onChange, label = 'Due date' }: { value: string; onChange(value: string): void; label?: string }) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value + 'T12:00:00') : undefined;
  return <div className="field"><span>{label}</span><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" aria-label={label}><CalendarDays size={15} />{date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Choose a date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} defaultMonth={date} onSelect={day => { onChange(day ? todayLocal(day) : ''); setOpen(false); }} /><Button type="button" variant="ghost" className="w-full" onClick={() => { onChange(''); setOpen(false); }}>Clear date</Button></PopoverContent></Popover></div>;
}
export function TaskEditor({ workspace, task, initialDate, change, close }: { workspace: Workspace; task?: Task; initialDate?: string; change: Change; close(): void }) {
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'Assignment');
  const [name, setName] = useState(task?.name ?? '');
  const [course, setCourse] = useState(task?.courseId ?? '');
  const [category, setCategory] = useState(task?.categoryId ?? '');
  const [date, setDate] = useState(task?.due ? todayLocal(new Date(task.due.includes('T') ? task.due : task.due + 'T12:00:00')) : initialDate ?? '');
  const localTime = (value: string) => value.includes('T') ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  const [time, setTime] = useState(localTime(task?.due ?? ''));
  const [end, setEnd] = useState(localTime(task?.end ?? ''));
  const [priority, setPriority] = useState(task?.priority ?? 'Medium');
  const [completedDate, setCompletedDate] = useState(text(task?.entity['University/Completion Date']).slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (!name.trim()) { setError('Give this task a name.'); return; }
    if ((time || end) && !date) { setError('Choose a date for the time.'); return; }
    if (end && (!time || end <= time)) { setError('End time must be after the start / due time on the same day.'); return; }
    setSaving(true);
    const saved = await change(draft => {
      const id = task?.id ?? crypto.randomUUID();
      const row: Entity = { ...task?.entity, 'fibery/id': id, 'University/Name': name.trim(),
        'University/Due Date': date ? time ? new Date(date + 'T' + time).toISOString() : date : null,
        'Dashboard/End': end && date ? new Date(date + 'T' + end).toISOString() : null,
        'University/Course': kind === 'Assignment' && course ? { 'fibery/id': course } : null,
        'University/Category': kind === 'To-Do' && category ? { 'fibery/id': category } : null,
      };
      let option = draft.academic.options['University/Priority'].find(x => x.name === priority);
      if (!option) { option = { id: crypto.randomUUID(), name: priority }; draft.academic.options['University/Priority'].push(option); }
      row['University/Priority'] = { 'fibery/id': option.id };
      if (task?.completed) row['University/Completion Date'] = completedDate || null;
      if (task) draft.academic.collections[collectionFor(task.kind)] = draft.academic.collections[collectionFor(task.kind)].filter(x => x['fibery/id'] !== task.id);
      draft.academic.collections[collectionFor(kind)].push(row);
    });
    setSaving(false); if (saved) close(); else setError('Could not save this task. Your changes remain here; see the workspace error for details.');
  }
  return <Modal title={task ? 'Edit task' : 'Add a task'} description="A little structure for whatever is next." close={close}><form onSubmit={e => { e.preventDefault(); void save(); }} className="editor-form">
    <div className="segmented">{(['Assignment', 'To-Do'] as const).map(type => <button type="button" aria-pressed={kind === type} key={type} onClick={() => setKind(type)}>{type}</button>)}</div>
    <Field label="Name"><Input autoFocus placeholder={kind === 'Assignment' ? 'e.g. Midterm exam' : 'e.g. Meet with academic advisor'} value={name} onChange={e => setName(e.target.value)} required /></Field>
    {kind === 'Assignment' ? <Field label="Course"><select value={course} onChange={e => setCourse(e.target.value)}><option value="">No course</option>{coursesFor(workspace).map(row => <option key={row['fibery/id']} value={row['fibery/id']}>{text(row['Dashboard/Code'])} {row['University/Name']}</option>)}</select></Field> : <Field label="Category"><select value={category} onChange={e => setCategory(e.target.value)}><option value="">Uncategorized</option>{workspace.academic.options['University/Category'].map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
    <div className="form-grid"><DateField value={date} onChange={setDate} /><Field label="Priority"><select value={priority} onChange={e => setPriority(e.target.value)}>{['Low', 'Medium', 'High', 'Urgent'].map(x => <option key={x}>{x}</option>)}</select></Field>
    <Field label="Due / start time (optional)"><Input type="time" value={time} onChange={e => setTime(e.target.value)} /></Field><Field label="Event end time (optional)"><Input type="time" value={end} onChange={e => setEnd(e.target.value)} /></Field></div>
    <p className="muted text-xs">Dates without a time are due at the end of that day. Manage courses and categories directly on the dashboard.</p>
    {task?.completed && <DateField value={completedDate} onChange={setCompletedDate} label="Completed on (for activity history)" />}
    {error && <p role="alert" className="error-text">{error}</p>}<div className="form-actions"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}</Button></div>
  </form></Modal>;
}
export function CourseEditor({ course, count, change, close }: { course?: Entity; count: number; change: Change; close(): void }) {
  const legacy = course?.['University/Academic Year'] as Record<string, unknown> | undefined;
  const legacyTerm = text(legacy?.['enum/name']);
  const [name, setName] = useState(course?.['University/Name'] ?? '');
  const [code, setCode] = useState(text(course?.['Dashboard/Code']));
  const [semester, setSemester] = useState(text(course?.['Dashboard/Semester']) || legacyTerm.split(' ')[0] || 'Fall');
  const [year, setYear] = useState(Number(course?.['Dashboard/Year']) || Number(legacyTerm.match(/\d{4}/)?.[0]) || new Date().getFullYear());
  const [credits, setCredits] = useState(Number(course?.['University/Credit Hours']) || 0);
  const [complete, setComplete] = useState(course?.['Dashboard/Completed'] === true);
  const [planned, setPlanned] = useState(course?.['Dashboard/PlanStatus'] === 'planned');
  const [color, setColor] = useState(text(course?.['Dashboard/Color']) || palette[count % palette.length]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return <Modal title={course ? 'Edit course' : 'Add a course'} description="Organize your semesters and keep your credits in view." close={close}><form className="editor-form" onSubmit={async e => { e.preventDefault(); setSaving(true); const ok = await change(draft => {
    const row: Entity = { ...course, 'fibery/id': course?.['fibery/id'] ?? crypto.randomUUID(), 'University/Name': name.trim(), 'Dashboard/Code': code.trim(), 'Dashboard/Semester': semester, 'Dashboard/Year': year, 'University/Credit Hours': credits, 'Dashboard/Completed': complete, 'Dashboard/Color': color };
    row['Dashboard/PlanStatus'] = planned && !complete ? 'planned' : 'in-progress';
    draft.academic.collections['University/Courses'] = [...draft.academic.collections['University/Courses'].filter(x => x['fibery/id'] !== row['fibery/id']), row];
  }); setSaving(false); if (ok) close(); else setError('Could not save. Your changes remain here; see the workspace error for details.'); }}>
    <div className="form-grid"><Field label="Course code"><Input value={code} onChange={e => setCode(e.target.value)} placeholder="CS 2114" /></Field><Field label="Credits"><Input type="number" min="0" max="60" step="0.5" required value={credits} onChange={e => setCredits(Number(e.target.value))} /></Field></div>
    <Field label="Course name"><Input value={name} onChange={e => setName(e.target.value)} required /></Field>
    <div className="form-grid"><Field label="Semester"><select value={semester} onChange={e => setSemester(e.target.value)}>{['Spring', 'Summer', 'Fall', 'Winter'].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Year"><Input type="number" min="1900" max="2200" required value={year} onChange={e => setYear(Number(e.target.value))} /></Field></div>
    <Field label="Calendar color"><div className="color-picker">{palette.map(x => <button type="button" key={x} style={{ background: x }} aria-label={x} aria-pressed={color === x} onClick={() => setColor(x)} />)}<input type="color" value={color} onChange={e => setColor(e.target.value)} aria-label="Custom course color" /></div></Field>
    {!complete && <label className="check-label"><input type="checkbox" checked={planned} onChange={e => setPlanned(e.target.checked)} /> Planned course — not yet in progress</label>}
    <label className="check-label"><input type="checkbox" checked={complete} onChange={e => setComplete(e.target.checked)} /> Course completed — count credits as fulfilled</label>
    {error && <p role="alert" className="error-text">{error}</p>}<div className="form-actions"><Button variant="ghost" type="button" onClick={close}>Cancel</Button><Button disabled={saving} type="submit">Save course</Button></div>
  </form></Modal>;
}
export function InternshipEditor({ item, categories, change, close }: { item?: Internship; categories: string[]; change: Change; close(): void }) {
  const [draft, setDraft] = useState<Internship>(item ? structuredClone(item) : createInternship());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const field = (key: keyof Internship, label: string, type = 'text') => <Field label={label}><Input type={type} value={String(draft[key])} onChange={e => setDraft({ ...draft, [key]: e.target.value })} required={key === 'company' || key === 'role'} /></Field>;
  return <Modal title={item ? 'Edit opportunity' : 'Add an internship'} description="Keep the next step in your career in one place." close={close}><form className="editor-form" onSubmit={async e => { e.preventDefault(); const error = validateInternship(draft); if (error) { setError(error); return; } setSaving(true); const ok = await change(workspace => {
    workspace.internships.internships = [...workspace.internships.internships.filter(x => x.id !== draft.id), { ...draft, updatedAt: todayLocal() }];
  }); setSaving(false); if (ok) close(); else setError('Could not save this internship. Your changes remain here; see the workspace error for details.'); }}>
    <div className="form-grid">{field('company', 'Company')}{field('role', 'Role')}{field('location', 'Location')}{field('url', 'Application URL')}</div>
    <Field label="Categories"><div className="category-checks">{categories.length ? categories.map(x => <label key={x}><input type="checkbox" checked={draft.tags.includes(x)} onChange={e => setDraft({ ...draft, tags: e.target.checked ? [...draft.tags, x] : draft.tags.filter(t => t !== x) })} />{x}</label>) : <span className="muted">Create categories from the internship toolbar.</span>}</div></Field>
    <div className="form-grid">{field('listedDate', 'Listed date', 'date')}{field('deadline', 'Deadline', 'date')}{field('appliedDate', 'Applied date', 'date')}{field('outcomeDate', 'Outcome date', 'date')}
    <Field label="Outcome"><select value={draft.outcome} onChange={e => setDraft({ ...draft, outcome: e.target.value as Internship['outcome'], ...(e.target.value === 'pending' ? { outcomeDate: '' } : {}) })}>{['pending', 'accepted', 'rejected', 'ghosted'].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Availability"><select value={draft.availability} onChange={e => setDraft({ ...draft, availability: e.target.value as Internship['availability'] })}><option>open</option><option>closed</option></select></Field></div>
    <Field label="Notes"><textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={3} /></Field>
    {error && <p role="alert" className="error-text">{error}</p>}<div className="form-actions"><Button variant="ghost" type="button" onClick={close}>Cancel</Button><Button type="submit" disabled={saving}>Save internship</Button></div>
  </form></Modal>;
}
export function ConfirmDelete({ name, detail, remove, close }: { name: string; detail?: string; remove(): Promise<boolean>; close(): void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Modal title={'Remove ' + name + '?'} description={detail ?? 'This record will be removed from your workspace.'} close={close}>{error && <p role="alert" className="error-text">{error}</p>}<div className="form-actions"><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); const ok = await remove(); setBusy(false); if (ok) close(); else setError('Could not remove this record. See the workspace error for details.'); }}><Trash2 />Remove</Button></div></Modal>;
}
