import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BookOpenText, ChevronDown, ChevronRight, Expand, Minimize2, Save, Download, FileUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { text } from '../data/planning';
import { todayLocal } from '../internships/model';
import type { Workspace } from '../platform/workspace';
import type { Entity } from '../data/academic';
import { ConfirmDelete, type Change } from './forms';
const ReactMarkdown = lazy(() => import('react-markdown'));

export function confirmLeaveNote() { return document.documentElement.dataset.noteDirty !== 'true' || window.confirm('This note has unsaved changes. Discard them?'); }
export function DailyNotes({ workspace, change, widget = false }: { workspace: Workspace; change: Change; widget?: boolean }) {
  const notes = workspace.academic.collections['University/Dashboard Notes'];
  const today = todayLocal();
  const [selected, setSelected] = useState<string>(() => notes.find(n => n['Dashboard/Date'] === today)?.['fibery/id'] ?? notes[0]?.['fibery/id']);
  const [query, setQuery] = useState(''), [sort, setSort] = useState('newest'), [removing, setRemoving] = useState<Entity>();
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const filtered = notes.filter(n => [n['University/Name'], text(n['University/Markdown']), text(n['Dashboard/Date'])].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'title' ? a['University/Name'].localeCompare(b['University/Name']) : (sort === 'oldest' ? 1 : -1) * text(a['Dashboard/Date']).localeCompare(text(b['Dashboard/Date'])));
  const note = notes.find(n => n['fibery/id'] === selected) ?? (widget ? notes.find(n => n['Dashboard/Date'] === today) : filtered[0]);
  useEffect(() => {
    // Never replace an unsaved editor when midnight creates the next daily note.
    if (widget && document.documentElement.dataset.noteDirty !== 'true') {
      const current = notes.find(n => n['Dashboard/Date'] === today);
      if (current) setSelected(current['fibery/id']);
    }
  }, [today, notes, widget]);
  async function create(name = 'Note · ' + today, markdown = '') {
    if (!confirmLeaveNote()) return;
    const id = crypto.randomUUID();
    if (await change(draft => draft.academic.collections['University/Dashboard Notes'].push({ 'fibery/id': id, 'University/Name': name, 'Dashboard/Date': today, 'University/Markdown': markdown }))) setSelected(id);
  }
  return <div className={widget ? 'daily-note-widget' : 'notes-page'}>
    {!widget && <div className="notes-toolbar"><Input aria-label="Search daily notes" placeholder="Search titles or Markdown…" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Sort daily notes" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select><Button size="sm" variant="outline" onClick={() => input.current?.click()}><FileUp />Open .md</Button><Button size="sm" onClick={() => void create()}><Plus />New note</Button><input ref={input} type="file" accept=".md,.markdown,text/markdown" hidden onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 2 * 1024 * 1024) { setError('Choose a Markdown file smaller than 2 MB.'); return; } try { await create(file.name.replace(/\.(md|markdown)$/i, ''), await file.text()); setError(''); } catch { setError('Could not read this Markdown file.'); } }} /></div>}
    {error && <p role="alert" className="error-text">{error}</p>}
    <div className={widget ? '' : 'notes-layout'}>{!widget && <Card className="note-index">{filtered.map(n => <div key={n['fibery/id']} className={'note-index-row ' + (n['fibery/id'] === note?.['fibery/id'] ? 'selected' : '')}><button onClick={() => { if (confirmLeaveNote()) setSelected(n['fibery/id']); }}><strong>{n['University/Name']}</strong><small>{text(n['Dashboard/Date']) || 'Undated note'}</small></button><Button variant="ghost" size="icon-sm" aria-label={'Delete note ' + n['University/Name']} onClick={() => setRemoving(n)}><Trash2 size={13} /></Button></div>)}{!filtered.length && <p className="compact-empty muted">No matching notes.</p>}</Card>}
    {note ? <NoteEditor key={note['fibery/id']} note={note} change={change} widget={widget} /> : <Card className="panel compact-empty muted">Today’s note will appear after the workspace reloads.</Card>}</div>
    {removing && <ConfirmDelete name={removing['University/Name']} detail="This note will be deleted. Export a .md copy first if you want to keep it. Today's automatic note will be recreated on the next day check if deleted." close={() => setRemoving(undefined)} remove={() => change(draft => { draft.academic.collections['University/Dashboard Notes'] = draft.academic.collections['University/Dashboard Notes'].filter(n => n['fibery/id'] !== removing['fibery/id']); })} />}
  </div>;
}
function NoteEditor({ note, change, widget }: { note: Entity; change: Change; widget: boolean }) {
  const [title, setTitle] = useState(note['University/Name']), [markdown, setMarkdown] = useState(text(note['University/Markdown']));
  const [saved, setSaved] = useState({ title, markdown }), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false), [open, setOpen] = useState(true);
  const dirty = title !== saved.title || markdown !== saved.markdown;
  useEffect(() => {
    document.documentElement.dataset.noteDirty = String(dirty);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { delete document.documentElement.dataset.noteDirty; window.removeEventListener('beforeunload', beforeUnload); };
  }, [dirty]);
  async function save() {
    if (!title.trim()) { setError('Give your note a title.'); return; }
    setBusy(true);
    const ok = await change(draft => { const row = draft.academic.collections['University/Dashboard Notes'].find(n => n['fibery/id'] === note['fibery/id']); if (!row) throw new Error('Note no longer exists.'); row['University/Name'] = title.trim(); row['University/Markdown'] = markdown; });
    setBusy(false); if (ok) { setTitle(title.trim()); setSaved({ title: title.trim(), markdown }); setError(''); } else setError('Could not save. Your unsaved text is still here.');
  }
  function download() {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = Array.from(title).map(c => c.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(c) ? '_' : c).join('') + '.md'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return <Card className={'panel note-editor ' + (expanded ? 'note-fullscreen' : '')}><Collapsible open={open || expanded} onOpenChange={setOpen}><div className="section-heading"><h2><CollapsibleTrigger asChild><Button variant="ghost" className="heading-toggle">{open ? <ChevronDown /> : <ChevronRight />}<BookOpenText size={16} />{widget ? 'Daily note' : 'Markdown note'}<small>{text(note['Dashboard/Date'])}</small></Button></CollapsibleTrigger></h2><div className="toolbar-actions"><span className="note-save-state">{dirty ? 'Unsaved' : 'Saved'}</span><Button size="icon-sm" variant="ghost" aria-label="Export note as Markdown" onClick={download}><Download /></Button><Button size="icon-sm" variant="ghost" aria-label={expanded ? 'Shrink note' : 'Expand note'} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 /> : <Expand />}</Button><Button size="sm" disabled={busy || !dirty} onClick={() => void save()}><Save />Save</Button></div></div><CollapsibleContent><div className="note-body"><Input disabled={busy} aria-label="Note title" value={title} onChange={e => setTitle(e.target.value)} /><Tabs defaultValue="write" className="note-tabs"><TabsList><TabsTrigger value="write">Write</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList><TabsContent value="write"><Textarea disabled={busy} aria-label="Markdown note" spellCheck value={markdown} onChange={e => setMarkdown(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); void save(); } }} /></TabsContent><TabsContent value="preview"><div className="markdown-preview"><Suspense fallback={<p className="muted">Loading preview…</p>}><ReactMarkdown skipHtml components={{ a: ({ children, href }) => <span title={href}>{children}</span>, img: ({ alt }) => <span>[Image: {alt}]</span> }}>{markdown}</ReactMarkdown></Suspense></div></TabsContent></Tabs>{error && <p role="alert" className="error-text">{error}</p>}<div className="note-help">Markdown · Ctrl/⌘ + S to save · export as .md · one daily note is created automatically while the app is running</div></div></CollapsibleContent></Collapsible></Card>;
}
