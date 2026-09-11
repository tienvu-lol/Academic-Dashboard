import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInternship, emptyDatabase, mergeInternships, needsReview, parseDatabase, semesterSeries, validateInternship} from '../src/internships/model.ts';
import {parseInternshipImport} from '../src/internships/importing.ts';
import {internshipRepository, INTERNSHIP_STORAGE_KEY} from '../src/internships/storage.ts';

const options = {sourceName: 'Simplify test fixture', snapshotDate: '2026-09-01', availability: 'open'};
const opportunity = overrides => ({...createInternship('2026-08-24'), company: 'Example Robotics', role: 'Engineering Intern', ...overrides});

test('Simplify HTML rows handle inherited company, links, locations, age and source closure', () => {
  const result = parseInternshipImport(`<table><tr><th>Company</th><th>Role</th><th>Location</th><th>Application</th><th>Age</th></tr>
    <tr><td><strong>Example &amp; Co</strong></td><td>Software Intern</td><td>Boston<br>Remote</td><td><a href="https://example.com/jobs/123"><img src="untrusted.png" /></a></td><td>2d</td></tr>
    <tr><td>↳</td><td>Hardware Intern</td><td>Boston</td><td>🔒</td><td>0d</td></tr></table>`, options);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].company, 'Example & Co');
  assert.equal(result.items[0].url, 'https://example.com/jobs/123');
  assert.equal(result.items[0].listedDate, '2026-08-30');
  assert.equal(result.items[0].location, 'Boston; Remote');
  assert.equal(result.items[1].company, 'Example & Co');
  assert.equal(result.items[1].sourceAvailability, 'closed');
  assert.equal(result.items[1].availability, 'open');
});

test('Markdown and quoted CSV imports preserve role columns and reject malformed CSV', () => {
  const markdown = '| Company | Role | Location | Application | Age |\n| --- | --- | --- | --- | --- |\n| [Example](https://example.com) | Intern | Remote | [Apply](https://example.com/job) | 1d |';
  assert.equal(parseInternshipImport(markdown, options).items[0].listedDate, '2026-08-31');
  const csv = 'Company,Role,Location,Notes\n"Example, Inc",Intern,Remote,"line one\nline two"';
  assert.equal(parseInternshipImport(csv, options).items[0].company, 'Example, Inc');
  assert.throws(() => parseInternshipImport('Company,Role\nExample,Intern,Extra', options), /columns/);
  assert.throws(() => parseInternshipImport('Company,Role\n"Example,Intern', options), /unclosed/);
});

test('reimport skips duplicates without changing manually recorded dates, availability or outcome', () => {
  const existing = opportunity({id: 'existing', url: 'https://example.com/job?id=123&utm_source=old', availability: 'closed', appliedDate: '2026-08-25', outcome: 'accepted', outcomeDate: '2026-08-31', notes: 'My contact'});
  const incoming = opportunity({id: 'incoming', url: 'https://example.com/job?id=123&utm_source=new'});
  const result = mergeInternships([existing], [incoming, incoming]);
  assert.deepEqual(result, {items: [existing], added: 0, duplicates: 2});
});

test('deadlines only flag pending applications for review', () => {
  const item = opportunity({deadline: '2026-08-27', appliedDate: '2026-08-25'});
  assert.equal(needsReview(item, '2026-09-01'), true);
  assert.equal(item.availability, 'open');
  assert.equal(item.outcome, 'pending');
  assert.equal(needsReview({...item, appliedDate: ''}, '2026-09-01'), false);
  assert.equal(needsReview({...item, outcome: 'accepted'}, '2026-09-01'), false);
});

test('chart sweeps dates cumulatively with opening balance, manual outcomes and blank future', () => {
  const data = [
    opportunity({listedDate: '2026-08-20', appliedDate: '2026-08-23', outcome: 'accepted', outcomeDate: '2026-08-25'}),
    opportunity({listedDate: '2026-08-24', appliedDate: '2026-08-25', outcome: 'rejected', outcomeDate: '2026-08-26'}),
    opportunity({listedDate: '', createdAt: '2026-08-26', deadline: '2026-08-26'}),
  ];
  const settings = {...emptyDatabase().settings, start: '2026-08-24', end: '2026-08-28'};
  const result = semesterSeries(data, settings, '2026-08-26');
  assert.deepEqual(result[0], {date: '2026-08-24', opportunities: 2, sent: 1, accepted: 0, rejected: 0});
  assert.deepEqual(result[2], {date: '2026-08-26', opportunities: 3, sent: 2, accepted: 1, rejected: 1});
  assert.deepEqual(result[4], {date: '2026-08-28', opportunities: null, sent: null, accepted: null, rejected: null});
  assert.equal(semesterSeries(data, {...settings, start: '2026-09-01'}).length, 0);
});

test('manual edits validate application chronology and safe links', () => {
  assert.match(validateInternship(opportunity({outcome: 'accepted'}), '2026-09-01'), /application date and outcome date/);
  assert.match(validateInternship(opportunity({appliedDate: '2026-08-23'}), '2026-09-01'), /before the listed date/);
  assert.match(validateInternship(opportunity({url: 'javascript:alert(1)'}), '2026-09-01'), /http/);
});

test('backups preserve histories and damaged backup does not silently reset to new opportunities', () => {
  const db = {...emptyDatabase(), internships: [opportunity({appliedDate: '2026-08-25', outcome: 'ghosted', outcomeDate: '2026-08-31', notes: 'No response'})]};
  assert.deepEqual(parseInternshipImport(JSON.stringify(db), options).items, db.internships);
  const damaged = {...db, internships: [{...db.internships[0], outcomeDate: ''}]};
  assert.throws(() => parseInternshipImport(JSON.stringify(damaged), options), /backup/);
  assert.throws(() => parseDatabase(JSON.stringify({...db, version: 9})), /backup/);
});

test('storage saves/reloads and leaves existing data untouched on corrupt read or write failure', () => {
  const values = new Map();
  const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  const repository = internshipRepository(storage);
  const db = {...emptyDatabase(), internships: [opportunity({})]};
  repository.save(db);
  assert.deepEqual(repository.load(), db);
  values.set(INTERNSHIP_STORAGE_KEY, '{broken');
  assert.throws(() => repository.load());
  assert.equal(values.get(INTERNSHIP_STORAGE_KEY), '{broken');
  const failing = internshipRepository({...storage, setItem() {throw new Error('Quota exceeded');}});
  assert.throws(() => failing.save(db), /Quota/);
});
