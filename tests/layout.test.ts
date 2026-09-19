import { expect, test } from 'bun:test';
import { dockWidget, layoutFor, resizeWidget, validLayouts, widgetPositions } from '../src/data/layout';
import { calendarLoads, emptyWorkspace, settingsFor, tasksFor, validateDashboardWorkspace } from '../src/data/planning';
import { BunSqlWorkspaceRepository } from '../src/platform/database';

test('left/right docking pairs calendar and tasks without overlap or changing unrelated widgets', () => {
  const original = layoutFor('dashboard');
  const layout = dockWidget(original, 'calendar', 'tasks', 'right');
  expect(layout.slice(0, 3)).toEqual(original.slice(0, 3));
  expect(layout[3]).toEqual({ id: 'tasks', span: 6 });
  expect(layout[4]).toEqual({ id: 'calendar', span: 6 });
  expect(original.find(x => x.id === 'calendar')?.span).toBe(12);
  const positions = widgetPositions(layout);
  expect(positions[3]).toEqual({ column: 1, row: 2 });
  expect(positions[4]).toEqual({ column: 7, row: 2 });
  const occupied = new Set<string>();
  for (let i = 0; i < layout.length; i++) {
    for (let column = positions[i].column; column < positions[i].column + layout[i].span; column++) {
      expect(column).toBeLessThanOrEqual(12);
      const cell = positions[i].row + ':' + column;
      expect(occupied.has(cell)).toBe(false); occupied.add(cell);
    }
  }
});

test('stat widgets reorder and all dimensions remain bounded', () => {
  const original = layoutFor('dashboard');
  expect(dockWidget(original, 'overdue', 'upcoming', 'before')[0].id).toBe('overdue');
  expect(dockWidget(original, 'upcoming', 'overdue', 'after')[2].id).toBe('upcoming');
  expect(dockWidget(original, 'missing', 'tasks', 'right')).toEqual(original);
  expect(resizeWidget(original, 'tasks', 50, 5000).find(x => x.id === 'tasks')).toEqual({ id: 'tasks', span: 12, height: 1600 });
  expect(resizeWidget(original, 'tasks', 1, 0).find(x => x.id === 'tasks')).toEqual({ id: 'tasks', span: 3, height: 140 });
  expect(resizeWidget(resizeWidget(original, 'tasks', 6, 300), 'tasks', 6).find(x => x.id === 'tasks')).toEqual({ id: 'tasks', span: 6 });
});

test('layout preferences are optional, tab-specific, and validated', () => {
  const w = emptyWorkspace();
  validateDashboardWorkspace(w);
  w.dashboardSettings = { ...settingsFor(w), layouts: { dashboard: [{ id: 'calendar', span: 6 }] } };
  validateDashboardWorkspace(w);
  expect(layoutFor('dashboard', w.dashboardSettings.layouts)).toHaveLength(9);
  expect(layoutFor('dashboard', w.dashboardSettings.layouts)[0].id).toBe('calendar');
  expect(layoutFor('internships', w.dashboardSettings.layouts)[0].id).toBe('opportunities');
  for (const invalid of [
    { dashboard: [{ id: 'calendar', span: -1 }] },
    { dashboard: [{ id: 'calendar', span: 6, height: Infinity }] },
    { dashboard: [{ id: 'unknown', span: 6 }] },
    { dashboard: [{ id: 'tasks', span: 6 }, { id: 'tasks', span: 6 }] },
    { settings: [] }, { toString: [] }, null, [],
  ]) expect(validLayouts(invalid)).toBe(false);
});

test('Bun SQL preserves both layouts while keeping records intact', async () => {
  const repository = new BunSqlWorkspaceRepository(':memory:');
  try {
    await repository.initialize();
    const w = emptyWorkspace();
    w.academic.collections['University/Assignments'].push({ 'fibery/id': 'task', 'University/Name': 'Preserve me' });
    w.dashboardSettings = { ...settingsFor(w), layouts: {
      dashboard: resizeWidget(dockWidget(layoutFor('dashboard'), 'calendar', 'tasks', 'right'), 'calendar', 6, 420),
      internships: dockWidget(layoutFor('internships'), 'rejected', 'opportunities', 'before'),
    } };
    await repository.save(w);
    const saved = (await repository.load())!;
    expect(saved.dashboardSettings?.layouts).toEqual(w.dashboardSettings.layouts);
    expect(saved.academic.collections).toEqual(w.academic.collections);
  } finally { await repository.close(); }
});

test('completed assignments do not inflate red workload on completed-only or mixed days', () => {
  const w = emptyWorkspace();
  w.academic.collections['University/Assignments'] = [
    { 'fibery/id': 'pending', 'University/Name': 'Pending', 'University/Due Date': '2026-09-18' },
    { 'fibery/id': 'done', 'University/Name': 'Done', 'University/Due Date': '2026-09-18', 'Dashboard/Completed': true },
    { 'fibery/id': 'only-done', 'University/Name': 'Done yesterday', 'University/Due Date': '2026-09-17', 'Dashboard/Completed': true },
  ];
  w.academic.collections['University/To-Dos'] = [{ 'fibery/id': 'todo', 'University/Name': 'Todo', 'University/Due Date': '2026-09-18' }];
  expect(calendarLoads(tasksFor(w))).toEqual({
    '2026-09-18': { pending: 1, completed: 1 },
    '2026-09-17': { pending: 0, completed: 1 },
  });
});
