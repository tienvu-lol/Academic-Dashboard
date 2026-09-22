import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');

test('desktop application icon assets are valid and configured for packaging', async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  expect(packageJson.build?.win?.icon).toBe('assets/app-icon.ico');
  expect(packageJson.build?.linux?.icon).toBe('assets/app-icon.png');

  const png = await readFile(path.join(root, 'assets', 'app-icon.png'));
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

  const ico = await readFile(path.join(root, 'assets', 'app-icon.ico'));
  expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
  expect(ico.readUInt16LE(4)).toBe(6);

  const electronMain = await readFile(path.join(root, 'electron', 'main.ts'), 'utf8');
  expect(electronMain).toContain("icon: path.join(app.getAppPath(), 'assets', 'app-icon.png')");
  expect(electronMain).toContain("app.setAppUserModelId('com.academicdashboard.desktop')");
});