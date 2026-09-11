import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {configureAcademicStorage, readAcademicData, optionId} from '../src/data/academic.ts';
import {commitAcademicImport, parseAcademicImport, previewAcademicImport} from '../src/data/academicImport.ts';
import {createEntity, getDocument, getEntityById, getSingleSelectOptions, queryEntities, setDocument, updateEntity} from '../src/lib/fibery.ts';
import {completeWorkItem} from '../src/completeWork.ts';

let raw;
beforeEach(() => {raw = null; configureAcademicStorage({read: () => raw, write: value => {raw = value;}});});
const read = type => queryEntities({type, fields: []});

test('Fibery CSV preview is read-only, commit connects courses and creates custom select options', async () => {
  const courses = parseAcademicImport('Name,Credits,Term\nECE 1004,3,Fall 2026', 'courses.csv', 'University/Courses');
  assert.equal(previewAcademicImport(courses).added, 1);
  assert.equal(raw, null);
  commitAcademicImport(courses);
  const tasks = parseAcademicImport('Name,Due Date,Course,Priority,Status\nLab 1,2026-09-15,ECE 1004,Critical,In Progress', 'tasks.csv', 'University/Assignments');
  commitAcademicImport(tasks);
  const [assignment] = await read('University/Assignments');
  const [course] = await read('University/Courses');
  assert.equal(assignment['University/Course']['fibery/id'], course['fibery/id']);
  assert.equal(assignment['University/Priority']['enum/name'], 'Critical');
  assert.equal(assignment['workflow/state']['enum/name'], 'In Progress');
  assert.equal(commitAcademicImport(tasks).added, 0);
  assert.equal((await read('University/Assignments')).length, 1);
});

test('Fibery JSON namespace fields and Markdown descriptions survive backup', async () => {
  const source = parseAcademicImport(JSON.stringify([{'fibery/id': 'course-1', 'University/Name': 'Robotics', 'University/Description': '# Course notes\n**Important**', 'custom/Extra': {value: 42}}]), 'course.json', 'University/Courses');
  commitAcademicImport(source);
  const [course] = await read('University/Courses');
  const doc = await getDocument({secret: course['University/Description']['Collaboration~Documents/secret']});
  assert.equal(doc.localMarkdown, '# Course notes\n**Important**');
  assert.deepEqual(course['custom/Extra'], {value: 42});
  const backup = JSON.stringify(readAcademicData());
  configureAcademicStorage({read: () => null, write: value => {raw = value;}});
  assert.equal(previewAcademicImport(parseAcademicImport(backup, 'backup.json', 'University/Courses')).added, 1);
});

test('invalid import is atomic and malformed CSV or dates produce actionable errors', () => {
  const source = parseAcademicImport('Name,Due Date\nGood,2026-09-15\nBad,2026-02-30', 'assignments.csv', 'University/Assignments');
  assert.throws(() => commitAcademicImport(source), /Nothing was imported/);
  assert.equal(raw, null);
  assert.throws(() => parseAcademicImport('Name,Credits\nTest,3,extra', 'courses.csv', 'University/Courses'), /columns/);
});

test('restoring a backup remaps assignments when an equivalent course already has a different local ID', async () => {
  const course = await createEntity({type: 'University/Courses', values: {'University/Name': 'Robotics'}});
  await createEntity({type: 'University/Assignments', values: {'University/Name': 'Robot lab', 'University/Course': {'fibery/id': course['fibery/id']}}});
  const backup = JSON.stringify(readAcademicData());
  raw = null;
  configureAcademicStorage({read: () => raw, write: value => {raw = value;}});
  const localCourse = await createEntity({type: 'University/Courses', values: {'University/Name': 'Robotics'}});
  const result = commitAcademicImport(parseAcademicImport(backup, 'backup.json', 'University/Courses'));
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 1);
  const [assignment] = await read('University/Assignments');
  assert.equal(assignment['University/Course']['fibery/id'], localCourse['fibery/id']);
});

test('manual academic changes are preserved when a matching ID is imported again', async () => {
  const source = parseAcademicImport('[{"id":"task-1","Name":"Task","Status":"Not Started"}]', 'tasks.json', 'University/To-Dos');
  commitAcademicImport(source);
  await updateEntity({type: 'University/To-Dos', id: 'task-1', values: {'University/Name': 'My edited task', 'workflow/state': {'fibery/id': optionId('workflow/state', 'In Progress')}}});
  assert.equal(commitAcademicImport(source).skipped, 1);
  assert.equal((await read('University/To-Dos'))[0]['University/Name'], 'My edited task');
});

test('completing work archives its course, priority, original date and full document before deleting source', async () => {
  const course = await createEntity({type: 'University/Courses', values: {'University/Name': 'ECE 1004'}});
  const priority = (await getSingleSelectOptions({type: 'University/Assignments', field: 'University/Priority'}))[0];
  const assignment = await createEntity({type: 'University/Assignments', values: {'University/Name': 'Lab', 'University/Due Date': '2026-09-15', 'University/Course': {'fibery/id': course['fibery/id']}, 'University/Priority': {'fibery/id': priority.id}}});
  const document = {comments: [{text: 'Retain original comment'}], doc: {type: 'doc', content: [{type: 'paragraph', content: [{type: 'text', text: 'Original'}]}]}, localMarkdown: 'Updated local notes'};
  await setDocument({secret: assignment['University/Description']['Collaboration~Documents/secret'], content: document});
  const archived = await completeWorkItem({id: assignment['fibery/id'], publicId: assignment['fibery/public-id'], name: 'Lab', type: 'Assignment', dueDate: '2026-09-15', contextId: course['fibery/id'], tagId: priority.id, tag: priority.name}, {types: [], priorities: [], categories: []});
  assert.equal((await read('University/Assignments')).length, 0);
  assert.equal((await read('University/Completed Work')).length, 1);
  assert.equal(archived['University/Original Due Date'], '2026-09-15');
  assert.equal(archived['University/Course']['University/Name'], 'ECE 1004');
  assert.deepEqual(await getDocument({secret: archived['University/Description']['Collaboration~Documents/secret']}), document);
});

test('corrupt saved data and failed writes do not clear the previous storage value', async () => {
  raw = '{broken';
  assert.throws(() => readAcademicData(), /left untouched/);
  await assert.rejects(() => createEntity({type: 'University/Courses', values: {'University/Name': 'Test'}}), /left untouched/);
  assert.equal(raw, '{broken');
  raw = null;
  configureAcademicStorage({read: () => raw, write: () => {throw new Error('Quota');}});
  await assert.rejects(() => createEntity({type: 'University/Courses', values: {'University/Name': 'Test'}}), /could not be saved/);
  assert.equal(raw, null);
});

test('failed document copy rolls back archive creation while preserving the original task', async () => {
  const task = await createEntity({type: 'University/To-Dos', values: {'University/Name': 'Keep me'}});
  let writes = 0;
  configureAcademicStorage({read: () => raw, write: value => {if (++writes === 2) throw new Error('Simulated copy failure'); raw = value;}});
  await assert.rejects(() => completeWorkItem({id: task['fibery/id'], name: 'Keep me', type: 'To-Do', dueDate: null, contextId: '', tagId: ''}, {types: [], priorities: [], categories: []}), /could not be saved/);
  assert.equal((await read('University/To-Dos')).length, 1);
  assert.equal((await read('University/Completed Work')).length, 0);
});

test('disabled Google Calendar query returns no events', async () => {
  assert.deepEqual(await read('Google Calendar/Event'), []);
});
