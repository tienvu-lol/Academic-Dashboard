import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storage} from './native-mock.mjs';
import {initialize, transact, useWorkspace} from '../src/platform/workspace.ts';
import {createEntity} from '../src/lib/fibery.ts';
import {readAcademicData} from '../src/data/academic.ts';
import {createInternship} from '../src/internships/model.ts';

test('native transactions persist both databases once and survive reload; failed writes roll back staging', async () => {
  await initialize(); assert.equal(useWorkspace().ready, true);
  const initial = useWorkspace().data;
  storage.fail = true;
  assert.equal(await transact(async draft => {
    await createEntity({type: 'University/Courses', values: {'University/Name': 'Failed course'}});
    draft.internships.internships.push({...createInternship(), company: 'Test', role: 'Failed role'});
  }), false);
  assert.deepEqual(useWorkspace().data, initial);
  assert.deepEqual(readAcademicData(), initial.academic);
  assert.equal(storage.text, '');
  storage.fail = false;
  assert.equal(await transact(async draft => {
    await createEntity({type: 'University/Courses', values: {'University/Name': 'CS 2505'}});
    draft.internships.internships.push({...createInternship(), company: 'Local company', role: 'Engineer'});
  }), true);
  assert.equal(storage.writes, 1);
  await initialize();
  assert.equal(useWorkspace().data.academic.collections['University/Courses'][0]['University/Name'], 'CS 2505');
  assert.equal(useWorkspace().data.internships.internships[0].company, 'Local company');
});
test('concurrent changes are blocked until the pending disk save finishes', async () => {
  let release; storage.hold = new Promise(resolve => {release = resolve;});
  const pending = transact(draft => {draft.preferences.compact = true;});
  await Promise.resolve();
  assert.equal(await transact(() => {throw new Error('must not execute');}), false);
  release(); await pending; storage.hold = null;
  assert.equal(useWorkspace().data.preferences.compact, true);
});
test('corrupt workspace is preserved and editing stays disabled', async () => {
  storage.text = '{broken'; const writes = storage.writes;
  await initialize();
  assert.equal(useWorkspace().ready, false);
  assert.equal(await transact(() => {}), false);
  assert.equal(storage.text, '{broken'); assert.equal(storage.writes, writes);
});
