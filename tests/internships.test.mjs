import {expect, test} from 'bun:test';
import {createInternship, emptyDatabase, mergeInternships, needsReview, parseDatabase, semesterSeries, validateInternship} from '../src/internships/model.ts';
import {parseInternshipImport} from '../src/internships/importing.ts';

const options = {sourceName: 'Simplify test fixture', snapshotDate: '2026-09-01', availability: 'open'};
const opportunity = overrides => ({...createInternship('2026-08-24'), company: 'Example Robotics', role: 'Engineering Intern', ...overrides});

test('Simplify HTML rows handle inherited company, links, locations, age and source closure', () => {
  const result = parseInternshipImport(`<table><tr><th>Company</th><th>Role</th><th>Location</th><th>Application</th><th>Age</th></tr>
    <tr><td><strong>Example &amp; Co</strong></td><td>Software Intern</td><td>Boston<br>Remote</td><td><a href="https://example.com/jobs/123"><img src="untrusted.png" /></a></td><td>2d</td></tr>
    <tr><td>↳</td><td>Hardware Intern</td><td>Boston</td><td>🔒</td><td>0d</td></tr></table>`, options);
  expect(result.items.length).toBe(2);
  expect(result.items[0].company).toBe('Example & Co');
  expect(result.items[0].url).toBe('https://example.com/jobs/123');
  expect(result.items[0].listedDate).toBe('2026-08-30');
  expect(result.items[0].location).toBe('Boston; Remote');
  expect(result.items[1].company).toBe('Example & Co');
  expect(result.items[1].sourceAvailability).toBe('closed');
  expect(result.items[1].availability).toBe('open');
});

test('Markdown and quoted CSV imports preserve role columns and reject malformed CSV', () => {
  const markdown = '| Company | Role | Location | Application | Age |\n| --- | --- | --- | --- | --- |\n| [Example](https://example.com) | Intern | Remote | [Apply](https://example.com/job) | 1d |';
  expect(parseInternshipImport(markdown, options).items[0].listedDate).toBe('2026-08-31');
  const csv = 'Company,Role,Location,Notes\n"Example, Inc",Intern,Remote,"line one\nline two"';
  expect(parseInternshipImport(csv, options).items[0].company).toBe('Example, Inc');
  expect(() => parseInternshipImport('Company,Role\nExample,Intern,Extra', options)).toThrow(/columns/);
  expect(() => parseInternshipImport('Company,Role\n"Example,Intern', options)).toThrow(/unclosed/);
});

test('reimport skips duplicates without changing manually recorded dates, availability or outcome', () => {
  const existing = opportunity({id: 'existing', url: 'https://example.com/job?id=123&utm_source=old', availability: 'closed', appliedDate: '2026-08-25', outcome: 'accepted', outcomeDate: '2026-08-31', notes: 'My contact'});
  const incoming = opportunity({id: 'incoming', url: 'https://example.com/job?id=123&utm_source=new'});
  const result = mergeInternships([existing], [incoming, incoming]);
  expect(result).toEqual({items: [existing], added: 0, duplicates: 2});
});

test('deadlines only flag pending applications for review', () => {
  const item = opportunity({deadline: '2026-08-27', appliedDate: '2026-08-25'});
  expect(needsReview(item, '2026-09-01')).toBe(true);
  expect(item.availability).toBe('open');
  expect(item.outcome).toBe('pending');
  expect(needsReview({...item, appliedDate: ''}, '2026-09-01')).toBe(false);
  expect(needsReview({...item, outcome: 'accepted'}, '2026-09-01')).toBe(false);
});

test('chart sweeps dates cumulatively with opening balance, manual outcomes and blank future', () => {
  const data = [
    opportunity({listedDate: '2026-08-20', appliedDate: '2026-08-23', outcome: 'accepted', outcomeDate: '2026-08-25'}),
    opportunity({listedDate: '2026-08-24', appliedDate: '2026-08-25', outcome: 'rejected', outcomeDate: '2026-08-26'}),
    opportunity({listedDate: '', createdAt: '2026-08-26', deadline: '2026-08-26'}),
  ];
  const settings = {...emptyDatabase().settings, start: '2026-08-24', end: '2026-08-28'};
  const result = semesterSeries(data, settings, '2026-08-26');
  expect(result[0]).toEqual({date: '2026-08-24', opportunities: 2, sent: 1, accepted: 0, rejected: 0});
  expect(result[2]).toEqual({date: '2026-08-26', opportunities: 3, sent: 2, accepted: 1, rejected: 1});
  expect(result[4]).toEqual({date: '2026-08-28', opportunities: null, sent: null, accepted: null, rejected: null});
  expect(semesterSeries(data, {...settings, start: '2026-09-01'}).length).toBe(0);
});

test('manual edits validate application chronology and safe links', () => {
  expect(validateInternship(opportunity({outcome: 'accepted'}), '2026-09-01')).toMatch(/application date and outcome date/);
  expect(validateInternship(opportunity({appliedDate: '2026-08-23'}), '2026-09-01')).toMatch(/before the listed date/);
  expect(validateInternship(opportunity({url: 'javascript:alert(1)'}), '2026-09-01')).toMatch(/http/);
});

test('backups preserve histories and damaged backup does not silently reset to new opportunities', () => {
  const db = {...emptyDatabase(), internships: [opportunity({appliedDate: '2026-08-25', outcome: 'ghosted', outcomeDate: '2026-08-31', notes: 'No response'})]};
  expect(parseInternshipImport(JSON.stringify(db), options).items).toEqual(db.internships);
  const damaged = {...db, internships: [{...db.internships[0], outcomeDate: ''}]};
  expect(() => parseInternshipImport(JSON.stringify(damaged), options)).toThrow(/backup/);
  expect(() => parseDatabase(JSON.stringify({...db, version: 9}))).toThrow(/backup/);
});
