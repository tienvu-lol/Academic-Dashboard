import { lazy, memo, Suspense, useMemo, useState } from 'react';
import { LayoutDashboard, BriefcaseBusiness, Settings2, PanelLeftClose, PanelLeftOpen, Plus, ChevronDown, ChevronRight, Search, Tags, Pencil, Trash2, GraduationCap, ArrowUpRight, Clock3, ListChecks, CircleAlert, BookOpen, BookOpenText, SlidersHorizontal, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDashboard } from './use-dashboard';
import { collectionFor, coursesFor, removeCourse, settingsFor, summaryFor, tasksFor, text, activityCounts, taskHistory, courseStatus, type Task } from '../data/planning';
import { TaskEditor, CourseEditor, InternshipEditor, ConfirmDelete, type Change } from './forms';
import { Planner } from './planner';
import { WidgetLayout } from './widget-layout';
import { Settings } from './settings';
import { TasksPanel } from './tasks-panel';
import { ActivityHeatmap } from './activity-heatmap';
import { DailyNotes, confirmLeaveNote } from './notes';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Workspace } from '../platform/workspace';
import type { Entity } from '../data/academic';
import { todayLocal, type Internship } from '../internships/model';
import { eventsFor, type CalendarEvent } from '../data/calendar';
import { CalendarEventEditor } from './calendar-event-editor';

type Page = 'Dashboard' | 'Daily notes' | 'Internships' | 'Settings';
const TaskAnalytics = lazy(() => import('./activity').then(module => ({ default: module.TaskAnalytics })));
const InternshipAnalytics = lazy(() => import('./activity').then(module => ({ default: module.InternshipAnalytics })));
const CategoryManager = lazy(() => import('./categories').then(module => ({ default: module.CategoryManager })));
const CreditPlan = lazy(() => import('./credit-plan').then(module => ({ default: module.CreditPlan })));
type Editor = { type: 'task'; task?: Task; date?: string } | { type: 'event'; event?: CalendarEvent; date?: string; time?: string } | { type: 'course'; course?: Entity } | { type: 'internship'; item?: Internship } | { type: 'categories'; internships?: boolean };
type Removal = { name: string; detail?: string; update(draft: Workspace): void };
function dateLabel(value: string) {
  if (!value) return 'No due date';
  const date = new Date(value.includes('T') ? value : value + 'T12:00:00');
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) + (value.includes('T') ? ' · ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
}
function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state"><ListChecks size={28} strokeWidth={1.3} /><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
export function App() {
  const { workspace, change, busy, error, load } = useDashboard();
  const [page, setPage] = useState<Page>('Dashboard');
  const [peek, setPeek] = useState(false);
  const [editingLayout, setEditingLayout] = useState(false);
  const [editor, setEditor] = useState<Editor>();
  const [removal, setRemoval] = useState<Removal>();
  const settings = useMemo(() => workspace ? settingsFor(workspace) : undefined, [workspace]);
  const today = new Date();
  const slim = settings?.sidebarSlim ?? false;
  const internships = workspace?.internships.internships ?? [];
  const categories = useMemo(() => [...new Set([...(settings?.internshipCategories ?? []), ...internships.flatMap(x => x.tags)])], [settings, internships]);
  function navigate(name: Page) {
    if (!confirmLeaveNote()) return;
    setPage(name);
    setPeek(false);
    document.querySelector('main')?.scrollTo(0, 0);
  }
  return <div className={'app-shell compact-shell ' + (slim ? 'sidebar-hidden ' : '') + (peek ? 'sidebar-peek' : '')}>
    <div className="titlebar-drag-region"><Button variant="ghost" size="icon-sm" className="titlebar-sidebar-toggle" disabled={!workspace || busy} aria-label={slim ? 'Show sidebar' : 'Hide sidebar'} onClick={() => { setPeek(false); void change(draft => { draft.dashboardSettings = { ...settingsFor(draft), sidebarSlim: !slim }; }); }}>{slim ? <PanelLeftOpen /> : <PanelLeftClose />}</Button><span>ACADEMIC <i>/</i> {page}</span></div>
    {slim && <button className="sidebar-edge" aria-label="Reveal navigation" onMouseEnter={() => setPeek(true)} onFocus={() => setPeek(true)} onClick={() => void change(draft => { draft.dashboardSettings = { ...settingsFor(draft), sidebarSlim: false }; })} />}
    <aside className="sidebar" inert={slim && !peek} aria-hidden={slim && !peek} onMouseLeave={() => setPeek(false)}><div className="brand"><div className="brand-mark"><GraduationCap size={19} /></div></div>
      <nav aria-label="Main navigation">{([{ name: 'Dashboard', icon: LayoutDashboard }, { name: 'Daily notes', icon: BookOpenText }, { name: 'Internships', icon: BriefcaseBusiness }, { name: 'Settings', icon: Settings2 }] as const).map(({ name, icon: Icon }) => <Button variant="ghost" key={name} title={name} aria-label={name} aria-current={page === name ? 'page' : undefined} className={'nav-item ' + (page === name ? 'active' : '')} onClick={() => navigate(name)}><Icon size={18} /><span>{name}</span></Button>)}</nav>
      <div className="sidebar-footer">{(page === 'Dashboard' || page === 'Internships') ? <Button variant={editingLayout ? 'secondary' : 'ghost'} className="layout-mode-toggle" aria-label={editingLayout ? 'Finish editing layout' : 'Edit layout'} aria-pressed={editingLayout} disabled={!workspace || busy} onClick={() => setEditingLayout(!editingLayout)}>{editingLayout ? <Check size={17} /> : <SlidersHorizontal size={17} />}<span>{editingLayout ? 'Done editing' : 'Edit layout'}</span></Button> : <small>Local workspace</small>}<small role="status">{busy ? 'Saving…' : 'Bun SQL'}</small></div>
    </aside>
    <main><div className={'content-wrap page-' + page.toLowerCase().replace(' ', '-')}><header className="page-header"><div><time className="page-date" dateTime={todayLocal(today)}>{today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</time><h1>{page}</h1>{page !== 'Dashboard' && <p>{page === 'Internships' ? 'Applications, deadlines, and daily activity.' : page === 'Daily notes' ? 'Your daily Markdown notebook. Search, edit, and export.' : 'Set the priorities that shape your day.'}</p>}</div>{workspace && (page === 'Dashboard' || page === 'Internships') && <Button className="page-primary-action" onClick={() => setEditor({ type: page === 'Dashboard' ? 'task' : 'internship' })}><Plus size={16} />{page === 'Dashboard' ? 'Add task' : 'Add internship'}</Button>}</header>
      {error && <div role="alert" className="error-banner"><CircleAlert size={18} /><span>{error}</span><Button variant="outline" size="sm" onClick={() => void load()}>Reload workspace</Button></div>}
      {!workspace ? <div className="panel empty-state"><p>{error ? 'Your saved data has been left untouched.' : 'Opening your workspace…'}</p></div> : page === 'Dashboard' ? <Dashboard workspace={workspace} change={change} busy={busy} editing={editingLayout} edit={setEditor} remove={setRemoval} /> : page === 'Daily notes' ? <DailyNotes workspace={workspace} change={change} /> : page === 'Internships' ? <Internships workspace={workspace} change={change} busy={busy} editing={editingLayout} categories={categories} edit={setEditor} remove={setRemoval} /> : <Settings workspace={workspace} change={change} />}
    </div></main>
    {workspace && editor?.type === 'task' && <TaskEditor workspace={workspace} task={editor.task} initialDate={editor.date} change={change} close={() => setEditor(undefined)} />}
    {workspace && editor?.type === 'event' && <CalendarEventEditor workspace={workspace} event={editor.event} initialDate={editor.date} initialTime={editor.time} change={change} close={() => setEditor(undefined)} remove={editor.event ? () => { const event = editor.event!; setEditor(undefined); setRemoval({ name: event.title, detail: event.recurrence ? 'This removes the entire recurring series. Individual occurrence deletion is not supported.' : 'This scheduled event will be removed from your calendar.', update: draft => { draft.calendarEvents = (draft.calendarEvents ?? []).filter(item => item.id !== event.id); } }); } : undefined} />}
    {workspace && editor?.type === 'course' && <CourseEditor course={editor.course} count={coursesFor(workspace).length} change={change} close={() => setEditor(undefined)} />}
    {editor?.type === 'internship' && <InternshipEditor item={editor.item} categories={categories} change={change} close={() => setEditor(undefined)} />}
    {workspace && editor?.type === 'categories' && <Suspense fallback={null}><CategoryManager workspace={workspace} internships={editor.internships} change={change} close={() => setEditor(undefined)} /></Suspense>}
    {removal && <ConfirmDelete name={removal.name} detail={removal.detail} remove={() => change(removal.update)} close={() => setRemoval(undefined)} />}
  </div>;
}
interface SectionProps { workspace: Workspace; edit(editor: Editor): void; remove(removal: Removal): void }
const Dashboard = memo(function Dashboard({ workspace, change, busy, editing, edit, remove }: SectionProps & { change: Change; busy: boolean; editing: boolean }) {
  const tasks = tasksFor(workspace), settings = settingsFor(workspace), stats = summaryFor(tasks);
  return <WidgetLayout page="dashboard" workspace={workspace} change={change} busy={busy} editing={editing} widgets={[
    ...[{ id: 'upcoming', label: 'Due soon', value: stats.upcoming, icon: Clock3, color: 'blue' }, { id: 'total', label: 'Active tasks', value: tasks.filter(task => !task.completed).length, icon: ListChecks, color: 'yellow' }, { id: 'overdue', label: 'Overdue', value: stats.overdue, icon: CircleAlert, color: stats.overdue > 0 ? 'red' : 'neutral' }].map(({ id, label, value, icon: Icon, color }) => ({ id, title: label, content: <Card className={'stat-card stat-' + color}><div className="stat-top"><Icon size={16} /><span>{label}</span></div><div className="stat-number">{value}</div></Card> })),
    { id: 'tasks', title: 'Tasks', content: <TasksPanel workspace={workspace} tasks={tasks} change={change} busy={busy} edit={task => edit({ type: 'task', task })} categories={() => edit({ type: 'categories' })} remove={task => remove({ name: task.name, update: draft => { draft.academic.collections[collectionFor(task.kind)] = draft.academic.collections[collectionFor(task.kind)].filter(x => x['fibery/id'] !== task.id); } })} /> },
    { id: 'calendar', title: 'Schedule', content: <Planner tasks={tasks} events={eventsFor(workspace)} courses={coursesFor(workspace)} settings={settings} editTask={task => edit({ type: 'task', task })} addEvent={(date, time) => edit({ type: 'event', date, time })} editEvent={event => edit({ type: 'event', event })} /> },
    { id: 'timeline', title: 'Due vs. done', content: <Suspense fallback={<Card className="panel compact-empty">Loading activity…</Card>}><TaskAnalytics workspace={workspace} /></Suspense> },
    { id: 'completions', title: 'Completion activity', content: <ActivityHeatmap title="Completion activity" noun="tasks completed" counts={activityCounts(taskHistory(workspace).map(t => t.done))} /> },
    { id: 'notes', title: 'Daily notes', content: <DailyNotes workspace={workspace} change={change} widget /> },
    { id: 'courses', title: 'Your courses', content: <Courses workspace={workspace} change={change} edit={edit} remove={remove} /> },
  ]} />;
});
function Courses({ workspace, change, edit, remove }: SectionProps & { change: Change }) {
  const courses = coursesFor(workspace);
  const [termFilter, setTermFilter] = useState('All semesters');
  const term = (course: Entity) => {
    const legacy = course['University/Academic Year'] as Record<string, unknown> | undefined;
    return text(course['Dashboard/Semester']) && course['Dashboard/Year'] ? course['Dashboard/Semester'] + ' ' + course['Dashboard/Year'] : text(legacy?.['enum/name']) || 'Unscheduled';
  };
  const termRank = (value: string) => Number(value.match(/\d{4}/)?.[0] ?? 0) * 10 + (['Spring', 'Summer', 'Fall', 'Winter'].indexOf(value.split(' ')[0]) + 1);
  const terms = [...new Set(courses.map(term))].sort((a, b) => termRank(b) - termRank(a));
  const fulfilled = courses.filter(c => c['Dashboard/Completed'] === true).reduce((n, c) => n + Number(c['University/Credit Hours'] ?? 0), 0);
  return <Card className="panel courses-panel"><Tabs defaultValue="courses"><div className="section-heading"><div><div className="eyebrow">THE BIGGER PICTURE</div><h2><BookOpen size={19} />Your courses</h2></div><div className="toolbar-actions"><span className="credits-total"><b>{fulfilled}</b> credits fulfilled</span><Button variant="outline" size="sm" onClick={() => edit({ type: 'course' })}><Plus />Add course</Button></div></div>
    <TabsList className="course-tabs"><TabsTrigger value="courses">Courses & semesters</TabsTrigger><TabsTrigger value="credits">DARS / credit plan</TabsTrigger></TabsList><TabsContent value="courses">
    {!!courses.length && <div className="course-filter"><select aria-label="Filter courses by semester and year" value={termFilter} onChange={e => setTermFilter(e.target.value)}><option>All semesters</option>{terms.map(t => <option key={t}>{t}</option>)}</select><span className="muted">{courses.length} courses · {courses.reduce((n, c) => n + Number(c['University/Credit Hours'] ?? 0), 0)} total credits</span></div>}
    {terms.filter(t => termFilter === 'All semesters' || termFilter === t).map(t => <div className="semester-group" key={t}><h3>{t}</h3><div className="course-grid">{courses.filter(c => term(c) === t).sort((a, b) => a['University/Name'].localeCompare(b['University/Name'])).map(c => <article className="course-card" key={c['fibery/id']} style={{ borderTopColor: text(c['Dashboard/Color']) || '#5D9DFC' }}><div className="course-card-top"><span>{text(c['Dashboard/Code']) || 'COURSE'}</span><div className="row-actions"><Button variant="ghost" size="icon-sm" aria-label={'Edit course ' + c['University/Name']} onClick={() => edit({ type: 'course', course: c })}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label={'Remove course ' + c['University/Name']} onClick={() => remove({ name: c['University/Name'], detail: 'Assignments are kept. Only this course and its associations are removed.', update: draft => removeCourse(draft, c['fibery/id']) })}><Trash2 /></Button></div></div><h4>{c['University/Name']}</h4><div className="course-card-bottom"><span>{Number(c['University/Credit Hours'] ?? 0)} credits</span><span className={c['Dashboard/Completed'] === true ? 'text-green' : 'muted'}>{c['Dashboard/Completed'] === true ? '✓ Fulfilled' : courseStatus(c) === 'planned' ? 'Planned' : 'In progress'}</span></div></article>)}</div></div>)}
    {!courses.length && <Empty title="Build your semester." detail="Add courses, choose their calendar colors, and track your credits." action={<Button variant="outline" size="sm" onClick={() => edit({ type: 'course' })}><Plus />Add your first course</Button>} />}
  </TabsContent><TabsContent value="credits"><Suspense fallback={<p className="compact-empty">Loading credit plan…</p>}><CreditPlan workspace={workspace} change={change} /></Suspense></TabsContent></Tabs></Card>;
}
const Internships = memo(function Internships({ workspace, categories, change, busy, editing, edit, remove }: SectionProps & { categories: string[]; change: Change; busy: boolean; editing: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('newest');
  const items = workspace.internships.internships;
  const shown = items.filter(x => (!category || x.tags.includes(category)) && (!status || x.outcome === status) && [x.company, x.role, x.location].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'company' ? a.company.localeCompare(b.company) : sort === 'deadline' ? (a.deadline || '9999').localeCompare(b.deadline || '9999') : sort === 'status' ? a.outcome.localeCompare(b.outcome) : b.createdAt.localeCompare(a.createdAt));
  return <WidgetLayout page="internships" workspace={workspace} change={change} busy={busy} editing={editing} widgets={[
    ...[{ id: 'opportunities', label: 'Opportunities', count: items.length, color: 'blue', filter: '' }, { id: 'applications', label: 'Applications sent', count: items.filter(x => x.appliedDate).length, color: 'blue', filter: '' }, { id: 'offers', label: 'Offers received', count: items.filter(x => x.outcome === 'accepted').length, color: 'green', filter: 'accepted' }, { id: 'rejected', label: 'Rejected', count: items.filter(x => x.outcome === 'rejected').length, color: 'red', filter: 'rejected' }].map(x => ({ id: x.id, title: x.label, content: <Card className={'stat-card stat-' + x.color}><div className="stat-top">{x.label}<ArrowUpRight size={18} /></div><div className="stat-number">{x.count}</div>{x.filter && <Button variant="ghost" size="sm" onClick={() => { setStatus(x.filter); setCategory(''); setQuery(''); setCollapsed(false); document.querySelector('[data-widget=tracker]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}>View {x.filter === 'accepted' ? 'offers' : 'rejections'}</Button>}</Card> })),
    { id: 'tracker', title: 'Internship tracker', content:
    <Card className="panel"><div className="section-heading"><div><div className="eyebrow">POSSIBILITIES, IN ONE PLACE</div><h2><button className="heading-toggle" aria-expanded={!collapsed} aria-controls="internship-list" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}Internship tracker <span className="count-badge">{items.length}</span></button></h2></div><Button variant="ghost" size="sm" onClick={() => edit({ type: 'categories', internships: true })}><Tags />Categories</Button></div>
    {!collapsed && <div id="internship-list"><div className="list-toolbar internship-toolbar"><div className="search-field"><Search size={15} /><Input aria-label="Search internships" value={query} placeholder="Company, role, or location…" onChange={e => setQuery(e.target.value)} /></div><select aria-label="Filter internship category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{categories.map(x => <option key={x}>{x}</option>)}</select><select aria-label="Filter internship outcome" value={status} onChange={e => setStatus(e.target.value)}><option value="">All outcomes</option>{['pending', 'accepted', 'rejected', 'ghosted'].map(x => <option key={x}>{x}</option>)}</select><select aria-label="Sort internships" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="deadline">Deadline</option><option value="company">Company A–Z</option><option value="status">Outcome</option></select></div>
      {shown.length ? shown.map(item => <article key={item.id} className="internship-row"><div className="internship-summary"><button className="internship-expand" aria-expanded={expanded === item.id} aria-label={'Details for ' + item.company} onClick={() => setExpanded(expanded === item.id ? undefined : item.id)}>{expanded === item.id ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</button><div className="company-initial">{item.company.slice(0, 1).toUpperCase()}</div><button className="internship-name" onClick={() => edit({ type: 'internship', item })}><strong>{item.company}</strong><small>{item.role}{item.location && ' · ' + item.location}</small></button><span className={'outcome outcome-' + item.outcome}>{item.outcome === 'pending' ? item.appliedDate ? 'Applied' : 'Not applied' : item.outcome}</span><span className="due-label">{item.deadline ? 'Due ' + dateLabel(item.deadline) : 'No deadline'}</span><div className="row-actions"><Button variant="ghost" size="icon-sm" aria-label={'Edit internship at ' + item.company} onClick={() => edit({ type: 'internship', item })}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label={'Remove internship at ' + item.company} onClick={() => remove({ name: item.role + ' at ' + item.company, update: draft => { draft.internships.internships = draft.internships.internships.filter(x => x.id !== item.id); } })}><Trash2 /></Button></div></div>{expanded === item.id && <div className="internship-detail"><div className="tag-list">{item.tags.map(t => <span key={t}>{t}</span>)}{!item.tags.length && <span>Uncategorized</span>}<span>{item.availability}</span></div><p>Listed: {dateLabel(item.listedDate)} · Applied: {item.appliedDate ? dateLabel(item.appliedDate) : 'Not yet'}{item.outcomeDate && ' · Outcome: ' + dateLabel(item.outcomeDate)}</p>{item.url && <p className="application-url">Application: {item.url}</p>}<p className="internship-notes">{item.notes || 'No notes yet. Edit this opportunity to add your next step.'}</p></div>}</article>) : <Empty title={items.length ? 'No matching opportunities.' : 'Your next opportunity starts here.'} detail={items.length ? 'Adjust your search or filters.' : 'Add an internship and organize it with your own categories.'} action={<Button variant="outline" size="sm" onClick={() => edit({ type: 'internship' })}><Plus />Add an internship</Button>} />}
    </div>}{collapsed && <p className="collapsed-summary">{items.length} opportunities saved</p>}</Card> },
    { id: 'outcomes', title: 'Application outcomes', content: <Suspense fallback={<Card className="panel compact-empty">Loading outcomes…</Card>}><InternshipAnalytics workspace={workspace} /></Suspense> },
    { id: 'activity', title: 'Application activity', content: <ActivityHeatmap title="Application activity" noun="applications submitted" counts={activityCounts(items.map(x => x.appliedDate))} /> },
  ]} />;
});
