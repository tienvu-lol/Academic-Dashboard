import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('dashboard exposes no AI task reprioritization control or renderer bridge', () => {
  const tasksPanel = source('src/features/tasks-panel.tsx');
  const app = source('src/features/app.tsx');
  const dashboardHook = source('src/features/use-dashboard.ts');
  const preload = source('electron/preload.ts');
  const electronMain = source('electron/main.ts');

  expect(tasksPanel).not.toContain('Auto-Prioritize');
  expect(tasksPanel).not.toContain('Use priority order');
  expect(tasksPanel).not.toContain('Restore automatic priority order');
  expect(tasksPanel).not.toContain('prioritize?:');
  expect(app).not.toContain('prioritize={prioritize}');
  expect(dashboardHook).not.toContain('const prioritize');
  expect(preload).not.toContain('workspace:prioritize');
  expect(electronMain).not.toContain("ipcMain.handle('workspace:prioritize'");
});
