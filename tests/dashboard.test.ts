import { expect, test } from 'bun:test';
import { emptyWorkspace, tasksFor, orderedTasks, summaryFor, settingsFor, isHighlighted, removeCourse, removeCategory, validateDashboardWorkspace, ensureDailyNote, setTaskCompleted, taskHistory, timelineFor, activityCounts, reorderIds, manuallyOrderedTasks, creditTotals } from '../src/data/planning';
import { BunSqlWorkspaceRepository } from '../src/platform/database';
import { startDashboardServer } from '../src/platform/dashboard-server';

function fixture() {
  const w = emptyWorkspace();
  w.academic.collections['University/Courses'].push({ 'fibery/id': 'cs', 'University/Name': 'Computer Science', 'Dashboard/Color': '#5D9DFC' });
  w.academic.collections['University/Assignments'] = [
    { 'fibery/id': 'hw', 'University/Name': 'Homework', 'University/Due Date': '2026-09-19', 'University/Course': { 'fibery/id': 'cs' } },
    { 'fibery/id': 'exam', 'University/Name': 'CS EXAM', 'University/Due Date': '2026-09-20', 'University/Course': { 'fibery/id': 'cs' } },
    { 'fibery/id': 'late', 'University/Name': 'Late work', 'University/Due Date': '2026-09-17' },
    { 'fibery/id': 'done', 'University/Name': 'Done work', 'University/Due Date': '2026-09-16', 'Dashboard/Completed': true },
    { 'fibery/id': 'undated', 'University/Name': 'Undated' },
  ];
  return w;
}
test('keyword and configurable priority rules are stable and course colors are retained', () => {
  const w = fixture(), tasks = tasksFor(w), settings = settingsFor(w);
  expect(orderedTasks(tasks, settings)[0].id).toBe('exam');
  expect(tasks.find(t => t.id === 'hw')?.color).toBe('#5D9DFC');
  expect(isHighlighted({ ...tasks[0], name: 'Latest results' }, settings)).toBe(false);
  expect(isHighlighted({ ...tasks[0], name: 'Test: chapter 2' }, settings)).toBe(true);
  settings.order = ['due', 'priority', 'course', 'keywords'];
  expect(orderedTasks(tasks.filter(t => !t.completed), settings)[0].id).toBe('late');
});
test('summary uses the next 48 hours and excludes completed tasks from overdue', () => {
  expect(summaryFor(tasksFor(fixture()), new Date('2026-09-18T12:00:00'))).toEqual({ total: 5, upcoming: 1, overdue: 1 });
});
test('course and category removal preserves tasks and clears dangling associations', () => {
  const w = fixture(), category = w.academic.options['University/Category'][0].id;
  w.calendarEvents!.push({ id: 'class', title: 'Lecture', courseId: 'cs', type: 'class', date: '2026-09-01', startTime: '09:00', endTime: '10:00' });
  w.academic.collections['University/To-Dos'].push({ 'fibery/id': 'todo', 'University/Name': 'Personal task', 'University/Category': { 'fibery/id': category } });
  removeCourse(w, 'cs'); removeCategory(w, category);
  expect(tasksFor(w)).toHaveLength(6);
  expect(tasksFor(w).find(t => t.id === 'hw')?.courseId).toBe('');
  expect(tasksFor(w).find(t => t.id === 'todo')?.categoryId).toBe('');
  expect(w.calendarEvents![0].courseId).toBe('');
  validateDashboardWorkspace(w);
});
test('Bun SQL keeps empty categories and dashboard settings after reload', async () => {
  const repository = new BunSqlWorkspaceRepository(':memory:');
  try {
    await repository.initialize();
    const w = fixture();
    w.academic.options['University/Category'] = [];
    w.dashboardSettings = { ...settingsFor(w), sidebarSlim: true, keywords: ['Quiz'], internshipCategories: ['Research'] };
    await repository.save(w);
    const saved = (await repository.load())!;
    expect(saved.academic.options['University/Category']).toEqual([]);
    expect(saved.dashboardSettings).toEqual(w.dashboardSettings);
    expect(saved.academic.collections).toEqual(w.academic.collections);
  } finally { await repository.close(); }
});
test('workspace service authenticates, validates and rejects stale writes without losing data', async () => {
  const server = await startDashboardServer(':memory:');
  const headers = { authorization: 'Bearer ' + server.token, 'content-type': 'application/json' };
  try {
    expect((await fetch(server.url)).status).toBe(403);
    expect((await fetch(server.url, { headers: { ...headers, origin: 'http://example.com' } })).status).toBe(403);
    const initial = await (await fetch(server.url, { headers })).json();
    const w = fixture();
    w.academic.collections['University/Dashboard Notes'] = initial.workspace.academic.collections['University/Dashboard Notes'];
    const save = () => fetch(server.url, { method: 'PUT', headers, body: JSON.stringify({ revision: initial.revision, workspace: w }) });
    const responses = await Promise.all([save(), save()]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    w.dashboardSettings!.order = ['due', 'due', 'due', 'due'];
    expect((await fetch(server.url, { method: 'PUT', headers, body: JSON.stringify({ revision: 1, workspace: w }) })).status).toBe(400);
    const saved = await (await fetch(server.url, { headers })).json();
    expect(saved.revision).toBe(initial.revision + 1);
    expect(saved.workspace.academic.collections['University/Assignments']).toHaveLength(5);
  } finally { await server.close(); }
});

test('daily notes are idempotent, preserve existing Markdown and create one note per local date', () => {
  const w = fixture();
  expect(ensureDailyNote(w, '2026-09-18')).toBe(true);
  w.academic.collections['University/Dashboard Notes'][0]['University/Markdown'] = '# My work\n\n- Kept\n';
  expect(ensureDailyNote(w, '2026-09-18')).toBe(false);
  expect(ensureDailyNote(w, '2026-09-19')).toBe(true);
  expect(w.academic.collections['University/Dashboard Notes']).toHaveLength(2);
  expect(w.academic.collections['University/Dashboard Notes'][0]['University/Markdown']).toBe('# My work\n\n- Kept\n');
});
test('completing and reopening tasks uses actual dates, while unknown historical dates remain unknown', () => {
  const w = fixture(), task = tasksFor(w)[0];
  setTaskCompleted(w, task, true, new Date('2026-09-18T12:00:00'));
  expect(activityCounts(taskHistory(w).map(x => x.done))).toEqual({ '2026-09-18': 1 });
  expect(timelineFor(w, '2026-09-18', '2026-09-20')).toEqual([
    { date: '2026-09-18', due: 2, done: 1 },
    { date: '2026-09-19', due: 3, done: 1 },
    { date: '2026-09-20', due: 4, done: 1 },
  ]);
  setTaskCompleted(w, tasksFor(w)[0], false);
  expect(activityCounts(taskHistory(w).map(x => x.done))).toEqual({});
});
test('manual task ordering handles filtered destinations without deleting hidden items', () => {
  const w = fixture(), tasks = tasksFor(w), settings = settingsFor(w);
  settings.taskOrder = reorderIds(['Assignment:hw', 'Assignment:exam', 'Assignment:late'], 'Assignment:late', 'Assignment:hw');
  expect(settings.taskOrder).toEqual(['Assignment:late', 'Assignment:hw', 'Assignment:exam']);
  expect(manuallyOrderedTasks(tasks, settings).map(x => x.id).slice(0, 3)).toEqual(['late', 'hw', 'exam']);
  expect(manuallyOrderedTasks(tasks, settings)).toHaveLength(5);
  expect(reorderIds(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
});
test('credit totals distinguish fulfilled, active and planned courses and persist requirements', async () => {
  const w = fixture(), courses = w.academic.collections['University/Courses'];
  courses[0]['University/Credit Hours'] = 3;
  courses.push({ 'fibery/id': 'math', 'University/Name': 'Math', 'University/Credit Hours': 4, 'Dashboard/Completed': true });
  courses.push({ 'fibery/id': 'future', 'University/Name': 'Future', 'University/Credit Hours': 2, 'Dashboard/PlanStatus': 'planned' });
  expect(creditTotals(courses)).toEqual({ completed: 4, inProgress: 3, planned: 2 });
  w.dashboardSettings = { ...settingsFor(w), creditPlan: { target: 120, notes: 'Advisor meeting', requirements: [{ id: 'core', name: 'Core', target: 30, notes: 'Keep electives separate', courseIds: ['cs', 'math'] }] } };
  validateDashboardWorkspace(w);
  const repository = new BunSqlWorkspaceRepository(':memory:');
  try { await repository.initialize(); await repository.save(w); expect((await repository.load())?.dashboardSettings?.creditPlan).toEqual(w.dashboardSettings.creditPlan); }
  finally { await repository.close(); }
  removeCourse(w, 'math');
  expect(w.dashboardSettings.creditPlan?.requirements[0].courseIds).toEqual(['cs']);
});
