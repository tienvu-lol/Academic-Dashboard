import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');

test('global UI styles avoid duplicated workspace rules and entrance-animation compositing', async () => {
  const css = await readFile(path.join(root, 'src', 'styles', 'globals.css'), 'utf8');
  expect(css.match(/\/\* Compact workspace\./g)?.length).toBe(1);
  expect(css).not.toContain('animation: page-presence');
  expect(css).not.toContain('.widget-motion-awaiting');
  expect(css).not.toContain('filter: brightness');
});