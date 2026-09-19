import { useState } from 'react';
import { Pencil, Plus, Trash2, Check, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ConfirmDelete, type Change } from './forms';
import { palette, removeCategory, settingsFor, reorderIds } from '../data/planning';
import type { Workspace } from '../platform/workspace';

export function CategoryManager({ workspace, internships = false, change, close }: { workspace: Workspace; internships?: boolean; change: Change; close(): void }) {
  const list = internships ? Array.from(new Set([...settingsFor(workspace).internshipCategories, ...workspace.internships.internships.flatMap(x => x.tags)])).map(name => ({ id: name, name, color: palette[1] })) : workspace.academic.options['University/Category'];
  const [editing, setEditing] = useState<string>();
  const [name, setName] = useState('');
  const [color, setColor] = useState(palette[1]);
  const [removing, setRemoving] = useState<{ id: string; name: string }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState('');
  async function reorder(from: string, to: string) {
    if (!from || from === to) return;
    setBusy(true);
    const ids = reorderIds(list.map(x => x.id), from, to);
    const ok = await change(draft => {
      if (internships) draft.dashboardSettings = { ...settingsFor(draft), internshipCategories: ids };
      else {
        const options = draft.academic.options['University/Category'];
        draft.academic.options['University/Category'] = ids.map(id => options.find(x => x.id === id)!);
      }
    });
    setBusy(false); setDragging('');
    if (!ok) setError('Could not save the category order.');
  }
  async function save() {
    const next = name.trim();
    if (!next) { setError('Enter a category name.'); return; }
    if (list.some(x => x.id !== editing && x.name.toLowerCase() === next.toLowerCase())) { setError('That category already exists.'); return; }
    setBusy(true);
    const ok = await change(draft => {
      if (internships) {
        const settings = settingsFor(draft);
        settings.internshipCategories = editing ? list.map(x => x.name === editing ? next : x.name) : [...list.map(x => x.name), next];
        draft.dashboardSettings = settings;
        if (editing) for (const item of draft.internships.internships) item.tags = item.tags.map(x => x === editing ? next : x);
      } else {
        const options = draft.academic.options['University/Category'];
        draft.academic.options['University/Category'] = editing ? options.map(x => x.id === editing ? { ...x, name: next, color } : x) : [...options, { id: crypto.randomUUID(), name: next, color }];
      }
    });
    setBusy(false); if (ok) { setEditing(undefined); setName(''); setError(''); }
  }
  return <><Modal title={internships ? 'Internship categories' : 'To-Do categories'} description="Create, rename, or remove categories as your plans change." close={close}><div className="category-manager">{list.map((x, index) => <div className="category-row" key={x.id} onDragOver={e => { if (dragging) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (dragging) void reorder(dragging, x.id); }}><Button variant="ghost" size="icon-sm" className="drag-grip" disabled={busy} draggable={!busy} aria-label={'Reorder category ' + x.name} title="Drag or use Alt + Up/Down to reorder" onDragStart={e => { setDragging(x.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', x.id); }} onDragEnd={() => setDragging('')} onKeyDown={e => { if (e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const target = list[index + (e.key === 'ArrowUp' ? -1 : 1)]; if (target) void reorder(x.id, target.id); } }}><GripVertical /></Button><span className="legend-dot" style={{ background: x.color }} /><span>{x.name}</span><Button variant="ghost" size="icon-sm" aria-label={'Edit ' + x.name} onClick={() => { setEditing(x.id); setName(x.name); setColor(x.color ?? palette[1]); }}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label={'Remove ' + x.name} onClick={() => setRemoving(x)}><Trash2 /></Button></div>)}</div>
    <form className="category-add" onSubmit={e => { e.preventDefault(); void save(); }}><Input aria-label="Category name" placeholder="New category name" value={name} onChange={e => setName(e.target.value)} required />{!internships && <input type="color" aria-label="Category color" value={color} onChange={e => setColor(e.target.value)} />}<Button disabled={busy} type="submit">{editing ? <Check /> : <Plus />}{editing ? 'Save' : 'Add'}</Button></form>{editing && <Button variant="ghost" onClick={() => { setEditing(undefined); setName(''); }}>Cancel edit</Button>}{error && <p role="alert" className="error-text">{error}</p>}
    </Modal>{removing && <ConfirmDelete name={removing.name} detail="Existing records stay in your workspace. Only their category association is removed." close={() => setRemoving(undefined)} remove={() => change(draft => {
      if (internships) { const settings = settingsFor(draft); settings.internshipCategories = list.map(x => x.name).filter(x => x !== removing.name); draft.dashboardSettings = settings; for (const item of draft.internships.internships) item.tags = item.tags.filter(x => x !== removing.name); }
      else removeCategory(draft, removing.id);
    })} />}</>;
}
