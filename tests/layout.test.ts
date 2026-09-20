import { expect, test } from 'bun:test';
import { appendWidget, dockWidget, emptySlots, layoutFor, placeInSlot, resizeWidget, validLayouts, widgetPositions } from '../src/data/layout';
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

test('left/right docking splits available row space, not always 50/50', () => {
  // Build a layout where 'total' and 'overdue' share row 1 (used=8), leaving 4 cols free.
  // Docking 'upcoming' to the right of 'total' should give upcoming=4, total=4 (sharing the 8 free cols evenly)
  // because after removing 'upcoming' from the row, total alone uses 4 of 12, leaving 8 available.
  const original = layoutFor('dashboard'); // upcoming(4), total(4), overdue(4) all in row 1
  // Remove overdue from row 1 to create slack: upcoming(4), total(4), [gap of 4], tasks(12)...
  const withoutOverdue = original.filter(x => x.id !== 'overdue').map(x => ({ ...x }));
  const docked = dockWidget(withoutOverdue, 'upcoming', 'total', 'right');
  const totalItem = docked.find(x => x.id === 'total')!;
  const upcomingItem = docked.find(x => x.id === 'upcoming')!;
  // total was alone in its row after removing upcoming; full 12 available → each gets 6
  expect(totalItem.span + upcomingItem.span).toBe(12);
  expect(totalItem.span).toBeGreaterThanOrEqual(3);
  expect(upcomingItem.span).toBeGreaterThanOrEqual(3);
  // Both must land on the same row
  const positions = widgetPositions(docked);
  const tIdx = docked.findIndex(x => x.id === 'total');
  const uIdx = docked.findIndex(x => x.id === 'upcoming');
  expect(positions[tIdx].row).toBe(positions[uIdx].row);
});

test('emptySlots detects trailing open columns in partially-filled rows', () => {
  // A layout with two stats (4+4=8) leaves 4 cols free in row 1.
  const partial = [{ id: 'upcoming', span: 4 }, { id: 'total', span: 4 }, { id: 'tasks', span: 12 }];
  const slots = emptySlots(partial);
  expect(slots).toHaveLength(1);
  expect(slots[0]).toEqual({ row: 1, column: 9, span: 4 });
  // Full rows produce no slots.
  const full = [{ id: 'upcoming', span: 4 }, { id: 'total', span: 4 }, { id: 'overdue', span: 4 }, { id: 'tasks', span: 12 }];
  expect(emptySlots(full)).toHaveLength(0);
  // A slot smaller than 3 columns is suppressed.
  const tinyGap = [{ id: 'upcoming', span: 4 }, { id: 'total', span: 4 }, { id: 'overdue', span: 3 }, { id: 'tasks', span: 12 }];
  // 4+4+3=11, gap=1 < 3 → no slot
  expect(emptySlots(tinyGap)).toHaveLength(0);
});

test('placeInSlot fills the trailing empty space and bails when slot is gone', () => {
  const layout = [{ id: 'upcoming', span: 4 }, { id: 'total', span: 4 }, { id: 'tasks', span: 12 }];
  // Move 'tasks' into the 4-col gap at the end of row 1.
  const result = placeInSlot(layout, 'tasks', 1);
  const tasksItem = result.find(x => x.id === 'tasks')!;
  // tasks should fill exactly the 4 remaining cols (12 - 4 - 4 = 4)
  expect(tasksItem.span).toBe(4);
  // tasks must be positioned immediately after the last widget in row 1
  const positions = widgetPositions(result);
  const tIdx = result.findIndex(x => x.id === 'tasks');
  expect(positions[tIdx].row).toBe(1);
  expect(positions[tIdx].column).toBe(9);
  // Bails and returns original when the specified row doesn't exist after source removal.
  const noSlot = placeInSlot(layout, 'upcoming', 99);
  expect(noSlot).toEqual(layout);
});

test('appendWidget fills trailing row space or starts a fresh full-width row', () => {
  // Partial last row (4+4=8, slack=4): source fills the slack.
  const partial = [{ id: 'upcoming', span: 4 }, { id: 'total', span: 4 }, { id: 'tasks', span: 12 }];
  const filled = appendWidget(partial, 'tasks');
  expect(filled[filled.length - 1]).toEqual({ id: 'tasks', span: 4 });
  expect(widgetPositions(filled)[filled.length - 1]).toEqual({ column: 9, row: 1 });
  // Full last row (4+4+4=12): source moves to a fresh row as span=12.
  const full = [{ id: 'upcoming', span: 4 }, { id: 'total', span: 4 }, { id: 'overdue', span: 4 }, { id: 'tasks', span: 12 }];
  const appended = appendWidget(full, 'tasks');
  expect(appended[appended.length - 1]).toEqual({ id: 'tasks', span: 12 });
  expect(widgetPositions(appended)[appended.length - 1].row).toBe(2);
  // Source is removed from its original position.
  expect(appended.filter(x => x.id === 'tasks')).toHaveLength(1);
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
