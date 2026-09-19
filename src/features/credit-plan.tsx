import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { coursesFor, creditTotals, settingsFor, type CreditRequirement } from '../data/planning';
import type { Workspace } from '../platform/workspace';
import { Field, Modal, ConfirmDelete, type Change } from './forms';

export function CreditPlan({ workspace, change }: { workspace: Workspace; change: Change }) {
  const plan = settingsFor(workspace).creditPlan ?? { target: 120, notes: '', requirements: [] };
  const [editing, setEditing] = useState<CreditRequirement | 'program'>();
  const [removing, setRemoving] = useState<CreditRequirement>();
  const courses = coursesFor(workspace), totals = creditTotals(courses);
  return <Card className="credit-plan"><CardHeader className="compact-card-header"><div><CardTitle>DARS / credit planner</CardTitle><CardDescription>Your own planning worksheet, not an official degree audit. Requirements may overlap.</CardDescription></div><Button size="sm" variant="outline" onClick={() => setEditing('program')}><Pencil />Edit plan</Button></CardHeader><CardContent><div className="credit-overview"><strong>{totals.completed}<small> / {plan.target} fulfilled</small></strong><span>{totals.inProgress} in progress</span><span>{totals.planned} planned</span><span>{Math.max(0, plan.target - totals.completed - totals.inProgress - totals.planned)} unplanned</span></div><Progress value={plan.target ? Math.min(100, totals.completed / plan.target * 100) : 0} aria-label="Degree credits fulfilled" /><div className="requirement-grid">{plan.requirements.map(r => {
    const credits = creditTotals(courses.filter(c => r.courseIds.includes(c['fibery/id'])));
    return <Card key={r.id} className="requirement-card"><div><strong>{r.name}</strong><Button size="icon-sm" variant="ghost" aria-label={'Edit requirement ' + r.name} onClick={() => setEditing(r)}><Pencil /></Button><Button size="icon-sm" variant="ghost" aria-label={'Delete requirement ' + r.name} onClick={() => setRemoving(r)}><Trash2 /></Button></div><p>{credits.completed} / {r.target} fulfilled · {credits.inProgress} in progress · {credits.planned} planned</p><Progress value={r.target ? Math.min(100, credits.completed / r.target * 100) : 0} aria-label={r.name + ' progress'} /><small>{courses.filter(c => r.courseIds.includes(c['fibery/id'])).map(c => c['University/Name']).join(', ') || 'No courses assigned'}</small>{r.notes && <p className="credit-notes">{r.notes}</p>}</Card>;
  })}</div><Button size="sm" variant="outline" onClick={() => setEditing({ id: crypto.randomUUID(), name: '', target: 3, courseIds: [], notes: '' })}><Plus />Requirement</Button>{plan.notes && <p className="credit-notes">{plan.notes}</p>}</CardContent>
    {editing && <PlanEditor key={typeof editing === 'string' ? editing : editing.id} item={editing} workspace={workspace} change={change} close={() => setEditing(undefined)} />}
    {removing && <ConfirmDelete name={removing.name} detail="Only this planning requirement is removed. Your courses are kept." close={() => setRemoving(undefined)} remove={() => change(draft => { const settings = settingsFor(draft); settings.creditPlan = { ...plan, requirements: plan.requirements.filter(r => r.id !== removing.id) }; draft.dashboardSettings = settings; })} />}
  </Card>;
}
function PlanEditor({ item, workspace, change, close }: { item: CreditRequirement | 'program'; workspace: Workspace; change: Change; close(): void }) {
  const plan = settingsFor(workspace).creditPlan ?? { target: 120, notes: '', requirements: [] };
  const [name, setName] = useState(item === 'program' ? '' : item.name), [target, setTarget] = useState(item === 'program' ? plan.target : item.target), [notes, setNotes] = useState(item === 'program' ? plan.notes : item.notes), [ids, setIds] = useState(item === 'program' ? [] : item.courseIds), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <Modal title={item === 'program' ? 'Edit degree plan' : 'Credit requirement'} description="Choose your targets and link courses. All credit values remain editable." close={close}><form className="editor-form" onSubmit={async e => { e.preventDefault(); setBusy(true); const ok = await change(draft => { const settings = settingsFor(draft), current = settings.creditPlan ?? plan; settings.creditPlan = item === 'program' ? { ...current, target, notes } : { ...current, requirements: [...current.requirements.filter(r => r.id !== item.id), { id: item.id, name: name.trim(), target, notes, courseIds: ids }] }; draft.dashboardSettings = settings; }); setBusy(false); if (ok) close(); else setError('Could not save the plan.'); }}>
    {item !== 'program' && <Field label="Requirement name"><Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Major core, Pathways, electives" /></Field>}<Field label="Required credits"><Input type="number" min="0" max="500" step="0.5" required value={target} onChange={e => setTarget(Number(e.target.value))} /></Field>
    {item !== 'program' && <div className="requirement-course-list">{coursesFor(workspace).map(c => <label key={c['fibery/id']}><Checkbox checked={ids.includes(c['fibery/id'])} onCheckedChange={checked => setIds(checked ? [...ids, c['fibery/id']] : ids.filter(id => id !== c['fibery/id']))} />{c['University/Name']}<small>{Number(c['University/Credit Hours'] ?? 0)} credits</small></label>)}</div>}
    <Field label="Planning notes"><Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} /></Field>{error && <p role="alert" className="error-text">{error}</p>}<div className="form-actions"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={busy}>Save plan</Button></div>
  </form></Modal>;
}
