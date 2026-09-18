import {beforeEach, expect, test} from 'bun:test';
import {configureAcademicStorage, readAcademicData, optionId} from '../src/data/academic.ts';
import {commitAcademicImport, parseAcademicImport, previewAcademicImport} from '../src/data/academicImport.ts';
import {createEntity, getDocument, getEntityById, getSingleSelectOptions, queryEntities, setDocument, updateEntity} from '../src/lib/fibery.ts';
import {completeWorkItem} from '../src/completeWork.ts';

let raw;
beforeEach(() => {raw = null; configureAcademicStorage({read: () => raw, write: value => {raw = value;}});});
const read = type => queryEntities({type, fields: []});

test('Fibery CSV preview is read-only, commit connects courses and creates custom select options', async () => {
  const courses = parseAcademicImport('Name,Credits,Term\nECE 1004,3,Fall 2026', 'courses.csv', 'University/Courses');
  expect(previewAcademicImport(courses).added).toBe(1);
  expect(raw).toBeNull();
  commitAcademicImport(courses);
  const tasks = parseAcademicImport('Name,Due Date,Course,Priority,Status\nLab 1,2026-09-15,ECE 1004,Critical,In Progress', 'tasks.csv', 'University/Assignments');
  commitAcademicImport(tasks);
  const [assignment] = await read('University/Assignments');
  const [course] = await read('University/Courses');
  expect(assignment['University/Course']['fibery/id']).toBe(course['fibery/id']);
  expect(assignment['University/Priority']['enum/name']).toBe('Critical');
  expect(assignment['workflow/state']['enum/name']).toBe('In Progress');
  expect(commitAcademicImport(tasks).added).toBe(0);
  expect((await read('University/Assignments')).length).toBe(1);
});

test('Fibery JSON namespace fields and Markdown descriptions survive backup', async () => {
  const source = parseAcademicImport(JSON.stringify([{'fibery/id': 'course-1', 'University/Name': 'Robotics', 'University/Description': '# Course notes\n**Important**', 'custom/Extra': {value: 42}}]), 'course.json', 'University/Courses');
  commitAcademicImport(source);
  const [course] = await read('University/Courses');
  const doc = await getDocument({secret: course['University/Description']['Collaboration~Documents/secret']});
  expect(doc.localMarkdown).toBe('# Course notes\n**Important**');
  expect(course['custom/Extra']).toEqual({value: 42});
  const backup = JSON.stringify(readAcademicData());
  configureAcademicStorage({read: () => null, write: value => {raw = value;}});
  expect(previewAcademicImport(parseAcademicImport(backup, 'backup.json', 'University/Courses')).added).toBe(1);
});

test('invalid import is atomic and malformed CSV or dates produce actionable errors', () => {
  const source = parseAcademicImport('Name,Due Date\nGood,2026-09-15\nBad,2026-02-30', 'assignments.csv', 'University/Assignments');
  expect(() => commitAcademicImport(source)).toThrow(/Nothing was imported/);
  expect(raw).toBeNull();
  expect(() => parseAcademicImport('Name,Credits\nTest,3,extra', 'courses.csv', 'University/Courses')).toThrow(/columns/);
});

test('restoring a backup remaps assignments when an equivalent course already has a different local ID', async () => {
  const course = await createEntity({type: 'University/Courses', values: {'University/Name': 'Robotics'}});
  await createEntity({type: 'University/Assignments', values: {'University/Name': 'Robot lab', 'University/Course': {'fibery/id': course['fibery/id']}}});
  const backup = JSON.stringify(readAcademicData());
  raw = null;
  configureAcademicStorage({read: () => raw, write: value => {raw = value;}});
  const localCourse = await createEntity({type: 'University/Courses', values: {'University/Name': 'Robotics'}});
  const result = commitAcademicImport(parseAcademicImport(backup, 'backup.json', 'University/Courses'));
  expect(result.added).toBe(1);
  expect(result.skipped).toBe(1);
  const [assignment] = await read('University/Assignments');
  expect(assignment['University/Course']['fibery/id']).toBe(localCourse['fibery/id']);
});

test('manual academic changes are preserved when a matching ID is imported again', async () => {
  const source = parseAcademicImport('[{"id":"task-1","Name":"Task","Status":"Not Started"}]', 'tasks.json', 'University/To-Dos');
  commitAcademicImport(source);
  await updateEntity({type: 'University/To-Dos', id: 'task-1', values: {'University/Name': 'My edited task', 'workflow/state': {'fibery/id': optionId('workflow/state', 'In Progress')}}});
  expect(commitAcademicImport(source).skipped).toBe(1);
  expect((await read('University/To-Dos'))[0]['University/Name']).toBe('My edited task');
});

test('completing work archives its course, priority, original date and full document before deleting source', async () => {
  const course = await createEntity({type: 'University/Courses', values: {'University/Name': 'ECE 1004'}});
  const priority = (await getSingleSelectOptions({type: 'University/Assignments', field: 'University/Priority'}))[0];
  const assignment = await createEntity({type: 'University/Assignments', values: {'University/Name': 'Lab', 'University/Due Date': '2026-09-15', 'University/Course': {'fibery/id': course['fibery/id']}, 'University/Priority': {'fibery/id': priority.id}}});
  const document = {comments: [{text: 'Retain original comment'}], doc: {type: 'doc', content: [{type: 'paragraph', content: [{type: 'text', text: 'Original'}]}]}, localMarkdown: 'Updated local notes'};
  await setDocument({secret: assignment['University/Description']['Collaboration~Documents/secret'], content: document});
  const archived = await completeWorkItem({id: assignment['fibery/id'], publicId: assignment['fibery/public-id'], name: 'Lab', type: 'Assignment', dueDate: '2026-09-15', contextId: course['fibery/id'], tagId: priority.id, tag: priority.name}, {types: [], priorities: [], categories: []});
  expect((await read('University/Assignments')).length).toBe(0);
  expect((await read('University/Completed Work')).length).toBe(1);
  expect(archived['University/Original Due Date']).toBe('2026-09-15');
  expect(archived['University/Course']['University/Name']).toBe('ECE 1004');
  expect(await getDocument({secret: archived['University/Description']['Collaboration~Documents/secret']})).toEqual(document);
});

test('corrupt saved data and failed writes do not clear the previous storage value', async () => {
  raw = '{broken';
  expect(() => readAcademicData()).toThrow(/left untouched/);
  await expect(createEntity({type: 'University/Courses', values: {'University/Name': 'Test'}})).rejects.toThrow(/left untouched/);
  expect(raw).toBe('{broken');
  raw = null;
  configureAcademicStorage({read: () => raw, write: () => {throw new Error('Quota');}});
  await expect(createEntity({type: 'University/Courses', values: {'University/Name': 'Test'}})).rejects.toThrow(/could not be saved/);
  expect(raw).toBeNull();
});

test('failed document copy rolls back archive creation while preserving the original task', async () => {
  const task = await createEntity({type: 'University/To-Dos', values: {'University/Name': 'Keep me'}});
  let writes = 0;
  configureAcademicStorage({read: () => raw, write: value => {if (++writes === 2) throw new Error('Simulated copy failure'); raw = value;}});
  await expect(completeWorkItem({id: task['fibery/id'], name: 'Keep me', type: 'To-Do', dueDate: null, contextId: '', tagId: ''}, {types: [], priorities: [], categories: []})).rejects.toThrow(/could not be saved/);
  expect((await read('University/To-Dos')).length).toBe(1);
  expect((await read('University/Completed Work')).length).toBe(0);
});

test('disabled Google Calendar query returns no events', async () => {
  expect(await read('Google Calendar/Event')).toEqual([]);
});
