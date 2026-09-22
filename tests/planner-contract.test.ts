import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('schedule clock continues updating in agenda and month views', async () => {
  const planner = await readFile(path.resolve(import.meta.dir, '../src/features/planner.tsx'), 'utf8');
  expect(planner).not.toContain("if (mode === 'month' || mode === 'agenda') return;");
  expect(planner).toContain('setInterval(() => setNow(new Date()), 60_000)');
});