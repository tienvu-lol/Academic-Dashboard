// Real Electron smoke test; uses an isolated SQLite database and browser profile.
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { buildElectronMain, spawnElectron } from './electron-runtime';
import { startDashboardServer } from '../src/platform/dashboard-server';
import { BunSqlWorkspaceRepository } from '../src/platform/database';
import { emptyWorkspace } from '../src/data/planning';
import { todayLocal } from '../src/internships/model';

const root = path.resolve(import.meta.dir, '..');
const temporary = await mkdtemp(path.join(tmpdir(), 'academic-ui-check-'));
const production = process.argv.includes('--production');
let electron: Awaited<ReturnType<typeof spawnElectron>> | undefined;
let vite: Awaited<ReturnType<typeof createServer>> | undefined;
let data: Awaited<ReturnType<typeof startDashboardServer>> | undefined;
let socket: WebSocket | undefined;
const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void }>();
const exceptions: string[] = [];
let sequence = 0;
async function until<T>(get: () => Promise<T>, label: string, timeout = 20000): Promise<NonNullable<T>> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = await get();
    if (result) return result as NonNullable<T>;
    await Bun.sleep(100);
  }
  throw new Error('Timed out: ' + label);
}
function send(method: string, params: Record<string, unknown> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
    socket!.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression: string) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(expression + '\n' + JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function click(label: string) {
  await evaluate("(() => { const el = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === " + JSON.stringify(label) + " || b.textContent.trim() === " + JSON.stringify(label) + "); if(!el) throw new Error('Missing button: ' + " + JSON.stringify(label) + "); if(el.getAttribute('role') === 'tab') el.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, button:0})); el.click(); })()");
}
async function fill(label: string, value: string) {
  await evaluate("(() => { const el = [...document.querySelectorAll('label')].find(l => l.querySelector('span')?.textContent === " + JSON.stringify(label) + ")?.querySelector('input'); if(!el) throw new Error('Missing field: ' + " + JSON.stringify(label) + "); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, " + JSON.stringify(value) + "); el.dispatchEvent(new Event('input', {bubbles:true})); })()");
}
async function waitFor(expression: string, label: string) { return until(() => evaluate(expression), label); }
async function reloadPage() {
  await evaluate("window.__smokeBeforeReload = true");
  await send('Page.reload');
  await waitFor("!window.__smokeBeforeReload && !!document.querySelector('.widget-grid')", 'new document after reload');
}
async function dialogClosed() {
  try { await waitFor("!document.querySelector('[role=dialog]')", 'dialog close'); }
  catch (error) { throw new Error(String(error) + ': ' + await evaluate("document.querySelector('[role=dialog]')?.textContent")); }
}
async function fillAria(label: string, value: string, textarea = false) {
  await evaluate("(() => { const el = document.querySelector('[aria-label=" + JSON.stringify(label) + "]'); if(!el) throw new Error('Missing aria field'); Object.getOwnPropertyDescriptor(" + (textarea ? 'HTMLTextAreaElement' : 'HTMLInputElement') + ".prototype, 'value').set.call(el, " + JSON.stringify(value) + "); el.dispatchEvent(new Event('input', {bubbles:true})); })()");
}
try {
  await buildElectronMain();
  const databaseFile = path.join(temporary, 'workspace.sqlite');
  const repository = new BunSqlWorkspaceRepository(databaseFile);
  await repository.initialize();
  const workspace = emptyWorkspace();
  workspace.academic.collections['University/Courses'].push({ 'fibery/id': 'cs', 'University/Name': 'Computer Science', 'Dashboard/Code': 'CS 2114', 'Dashboard/Color': '#5D9DFC', 'Dashboard/Year': 2026, 'Dashboard/Semester': 'Fall', 'University/Credit Hours': 3 });
  workspace.academic.collections['University/Assignments'].push({ 'fibery/id': 'exam', 'University/Name': 'CS Exam', 'University/Due Date': todayLocal(), 'University/Course': { 'fibery/id': 'cs' } });
  await repository.save(workspace);
  await repository.close();
  data = await startDashboardServer(databaseFile);
  let developmentUrl = '';
  if (!production) {
    vite = await createServer({ root, server: { port: 0, strictPort: false } });
    await vite.listen();
    developmentUrl = vite.resolvedUrls!.local[0];
  }
  electron = await spawnElectron({ VITE_DEV_SERVER_URL: developmentUrl, DASHBOARD_DATA_URL: data.url, DASHBOARD_DATA_TOKEN: data.token }, ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--user-data-dir=' + temporary]);
  const debugPort = await until(async () => {
    try { return (await readFile(path.join(temporary, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return ''; }
  }, 'Electron debugging endpoint');
  const target = await until(async () => {
    const pages = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json() as { type: string; webSocketDebuggerUrl: string }[];
    return pages.find(p => p.type === 'page');
  }, 'renderer target');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => { socket!.onopen = () => resolve(); socket!.onerror = () => reject(new Error('CDP connection failed')); });
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data));
    if (message.id) { const request = pending.get(message.id); pending.delete(message.id); if (message.error) request?.reject(new Error(message.error.message)); else request?.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(JSON.stringify(message.params.exceptionDetails));
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') exceptions.push(message.params.entry.text);
  };
  await send('Runtime.enable'); await send('Log.enable');
  await waitFor("document.querySelector('.task-name-button')?.textContent.includes('CS Exam')", 'dashboard and SQL load');
  const sandbox = await evaluate("({ node: typeof window.require, bridge: typeof window.dashboard?.load })");
  if (sandbox.node !== 'undefined' || sandbox.bridge !== 'function') throw new Error('Unexpected renderer isolation');
  await click('Add task');
  await waitFor("!!document.querySelector('[role=dialog]')", 'task editor');
  await fill('Name', 'Practice assignment');
  await click('Due date');
  await waitFor("!!document.querySelector('[data-slot=popover-content] [data-slot=calendar]')", 'mini calendar');
  await evaluate("document.querySelector('[data-slot=popover-content] [data-slot=calendar] button[data-day]:not([disabled])').click()");
  await waitFor("!document.querySelector('[data-slot=popover-content] [data-slot=calendar]')", 'calendar selection');
  // Select the dialog submit, not the dashboard's button with the same label.
  await evaluate("document.querySelector('[role=dialog] button[type=submit]').click()");
  await dialogClosed();
  await waitFor("document.querySelector('.task-table')?.textContent.includes('Practice assignment')", 'task save');
  await evaluate("document.querySelector('button[aria-label=\"Reorder Practice assignment\"]').dispatchEvent(new DragEvent('dragstart', { bubbles:true, dataTransfer:new DataTransfer() }))");
  await evaluate("document.querySelector('button[aria-label=\"Reorder CS Exam\"]').closest('tr').dispatchEvent(new DragEvent('dragover', {bubbles:true,cancelable:true,dataTransfer:new DataTransfer()}))");
  await evaluate("document.querySelector('button[aria-label=\"Reorder CS Exam\"]').closest('tr').dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:new DataTransfer()}))");
  await Bun.sleep(150);
  await waitFor("document.querySelector('.task-name-button')?.textContent.includes('Practice assignment')", 'drag task ordering');
  await click('Complete Practice assignment');
  await waitFor("!document.querySelector('.task-table')?.textContent.includes('Practice assignment')", 'complete task');
  await click('Completed');
  await waitFor("document.querySelector('.task-table')?.textContent.includes('Practice assignment')", 'completed filter');
  await click('Active');
  await click('Add event');
  await waitFor("!!document.querySelector('[role=dialog]')", 'event editor');
  await fill('Title', 'Persistence seminar');
  await fill('Start time', '13:00');
  await fill('End time', '14:30');
  await evaluate("document.querySelector('[role=dialog] button[type=submit]').click()");
  await dialogClosed();
  await waitFor("[...document.querySelectorAll('.calendar-event-chip')].some(x => x.textContent.includes('Persistence seminar'))", 'one-time event save');
  await reloadPage();
  await waitFor("[...document.querySelectorAll('.calendar-event-chip')].some(x => x.textContent.includes('Persistence seminar'))", 'one-time event persistence after renderer restart');

  await click('Add event');
  await waitFor("!!document.querySelector('[role=dialog]')", 'recurring event editor');
  await fill('Title', 'MWF Lecture');
  await fill('Start time', '09:30');
  await fill('End time', '10:45');
  await evaluate("[...document.querySelectorAll('[role=dialog] label')].find(x => x.textContent.includes('Repeat weekly')).querySelector('input').click()");
  await click('Sun'); await click('Mon'); await click('Wed'); await click('Fri');
  await evaluate("document.querySelector('[role=dialog] button[type=submit]').click()");
  await dialogClosed();
  await waitFor("[...document.querySelectorAll('.calendar-event-chip')].filter(x => x.textContent.includes('MWF Lecture')).length >= 2", 'recurring event occurrences in month');

  await click('week');
  await waitFor("document.querySelectorAll('.time-day-heading').length === 7", 'week view');
  await waitFor("document.querySelectorAll('.calendar-event-block').length >= 4", 'duration event blocks in week');
  await waitFor("document.querySelectorAll('.current-time-line').length === 1", 'week current-time line');
  await evaluate("document.querySelector('button[aria-label=\"Add event on " + todayLocal() + " at 15:00\"]').click()");
  await waitFor("!!document.querySelector('[role=dialog]')", 'time-cell event editor');
  if (await evaluate("[...document.querySelectorAll('[role=dialog] label')].find(x => x.querySelector('span')?.textContent === 'Start time')?.querySelector('input').value") !== '15:00') throw new Error('Time-cell event creation did not prefill its hour');
  await click('Cancel'); await dialogClosed();
  await evaluate("document.querySelector('.time-scroll').scrollTop = 390");
  const weekCalendarShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await Bun.write(path.join(root, 'artifacts', 'ui-calendar-week.png'), Buffer.from(weekCalendarShot.data, 'base64'));
  await click('day');
  await waitFor("document.querySelectorAll('.time-day-heading').length === 1", 'day view');
  await waitFor("document.querySelectorAll('.current-time-line').length === 1", 'day current-time line');
  const dayCalendarShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await Bun.write(path.join(root, 'artifacts', 'ui-calendar-day.png'), Buffer.from(dayCalendarShot.data, 'base64'));
  await click('month');
  await waitFor("[35, 42].includes(document.querySelectorAll('.full-calendar .planner-day').length)", 'shadcn month grid');
  await waitFor("!!document.querySelector('.planner-day.workload-1')", 'assignment density heatmap');
  await waitFor("!!document.querySelector('.calendar-task-completed') && !!document.querySelector('.day-load-completed')", 'green completed calendar task and load');
  if (await evaluate("!!document.querySelector('.calendar-task-completed.first-ranked')")) throw new Error('Completed task incorrectly remains the active #1 priority');
  if (await evaluate("[...document.querySelectorAll('.full-calendar .rdp-weekday')].some(x => getComputedStyle(x).borderRadius !== '0px')")) throw new Error('Weekday heading rounding clips the month grid');
  await evaluate("[...document.querySelectorAll('.calendar-event-chip')].find(x => x.textContent.includes('MWF Lecture')).click()");
  await waitFor("!!document.querySelector('[role=dialog]')", 'edit recurring series');
  await fill('Title', 'MWF Lecture Updated');
  await evaluate("document.querySelector('[role=dialog] button[type=submit]').click()");
  await dialogClosed();
  await waitFor("[...document.querySelectorAll('.calendar-event-chip')].some(x => x.textContent.includes('MWF Lecture Updated'))", 'recurring series edit');
  await evaluate("[...document.querySelectorAll('.calendar-event-chip')].find(x => x.textContent.includes('MWF Lecture Updated')).click()");
  await click('Delete series');
  await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Remove MWF Lecture Updated')", 'delete series confirmation');
  await click('Remove'); await dialogClosed();
  await waitFor("![...document.querySelectorAll('.calendar-event-chip')].some(x => x.textContent.includes('MWF Lecture Updated'))", 'recurring series deletion');
  await click('Hide sidebar');
  await waitFor("!!document.querySelector('.sidebar-hidden')", 'sidebar persistence');
  await click('Show sidebar');
  await waitFor("!document.querySelector('.sidebar-hidden')", 'sidebar expansion');
  await click('Settings');
  await waitFor("!!document.querySelector('.settings-panel')", 'settings');
  await fill('Keywords to emphasize', 'Test, Exam, Quiz');
  await click('Save preferences');
  await waitFor("document.body.textContent.includes('Preferences saved')", 'settings save');
  await click('Dashboard');
  await click('Categories');
  await waitFor("!!document.querySelector('.category-manager')", 'To-Do category editor');
  await evaluate("document.querySelector('button[aria-label=\"Reorder category Academic\"]').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowUp',altKey:true,bubbles:true}))");
  await waitFor("document.querySelector('.category-manager .category-row')?.textContent.includes('Academic')", 'category keyboard ordering');
  await click('Close'); await dialogClosed();
  await click('Internships');
  await click('Categories');
  await waitFor("!!document.querySelector('.category-add')", 'category manager');
  await evaluate("(() => { const el = document.querySelector('input[aria-label=\"Category name\"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Research'); el.dispatchEvent(new Event('input', {bubbles:true})); })()");
  await click('Add');
  await waitFor("document.querySelector('.category-manager')?.textContent.includes('Research')", 'category save');
  await click('Close');
  await dialogClosed();
  await click('Add internship');
  await waitFor("!!document.querySelector('[role=dialog]')", 'internship editor');
  await fill('Company', 'Example Research');
  await fill('Role', 'Software Intern');
  await fill('Applied date', todayLocal());
  await fill('Outcome date', todayLocal());
  await evaluate("(() => { const el = [...document.querySelectorAll('label')].find(x => x.querySelector('span')?.textContent === 'Outcome').querySelector('select'); el.value = 'rejected'; el.dispatchEvent(new Event('change', {bubbles:true})); })()");
  await evaluate("document.querySelector('.category-checks input').click()");
  await click('Save internship');
  await dialogClosed();
  await waitFor("document.querySelector('.internship-name')?.textContent.includes('Example Research')", 'internship save');
  await click('Details for Example Research');
  await waitFor("document.querySelector('.internship-detail')?.textContent.includes('Research')", 'internship details');
  await waitFor("document.querySelector('[data-widget=rejected] .stat-number')?.textContent === '1'", 'rejected application total');
  await waitFor("document.querySelectorAll('.internship-timeline-panel .recharts-line').length === 3", 'applications, offers, and rejection chart series');
  await click('View rejections');
  await waitFor("document.querySelector('select[aria-label=\"Filter internship outcome\"]')?.value === 'rejected' && !!document.querySelector('.outcome-rejected')", 'rejected application filter');
  await click('Edit layout');
  await waitFor("!!document.querySelector('.layout-editing')", 'internship layout edit mode');
  await click('Move Rejected up');
  await waitFor("document.querySelectorAll('.workspace-widget')[2]?.getAttribute('data-widget') === 'rejected'", 'internship stat movement');
  await click('Finish editing layout');
  await click('Dashboard');
  await click('Add course');
  await waitFor("!!document.querySelector('[role=dialog]')", 'course editor');
  await fill('Course name', 'Calculus');
  await fill('Course code', 'MATH 1226');
  await fill('Credits', '4');
  await evaluate("[...document.querySelectorAll('.check-label')].find(el => el.textContent.includes('Course completed')).querySelector('input').click()");
  await click('Save course');
  await dialogClosed();
  await waitFor("document.querySelector('.credits-total')?.textContent.includes('4')", 'fulfilled credits');
  await click('DARS / credit plan');
  await waitFor("!!document.querySelector('.credit-plan')", 'credit planner');
  await click('Requirement');
  await waitFor("!!document.querySelector('[role=dialog]')", 'requirement editor');
  await fill('Requirement name', 'Core requirements');
  await fill('Required credits', '30');
  await evaluate("document.querySelector('.requirement-course-list button[role=checkbox]').click()");
  await click('Save plan'); await dialogClosed();
  await waitFor("document.querySelector('.requirement-card')?.textContent.includes('Core requirements')", 'credit plan saved');
  await click('Daily notes');
  await waitFor("!!document.querySelector('.note-editor')", 'automatic daily note');
  await fillAria('Markdown note', '# Smoke note\n\n**bold** text\n\n- Task', true);
  await click('Save');
  await waitFor("document.querySelector('.note-save-state')?.textContent === 'Saved'", 'Markdown save');
  await click('Preview');
  await waitFor("document.querySelector('.markdown-preview strong')?.textContent === 'bold'", 'Markdown preview');
  await click('Expand note');
  await waitFor("!!document.querySelector('.note-fullscreen')", 'note expansion');
  await click('Shrink note');
  const fixturePath = path.join(temporary, 'Imported note.md');
  await Bun.write(fixturePath, '# Imported Markdown\n\nKept exactly.\n');
  const document = await send('DOM.getDocument');
  const input = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '.notes-toolbar input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [fixturePath] });
  await waitFor("document.querySelector('input[aria-label=\"Note title\"]')?.value === 'Imported note'", 'Markdown file import');
  const downloadPath = path.join(temporary, 'downloads');
  await mkdir(downloadPath);
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath });
  await click('Export note as Markdown');
  await until(async () => { try { return (await readFile(path.join(downloadPath, 'Imported note.md'), 'utf8')) === '# Imported Markdown\n\nKept exactly.\n'; } catch { return false; } }, 'Markdown export');
  await click('Dashboard');
  await reloadPage();
  await waitFor("document.querySelector('.course-grid')?.textContent.includes('Calculus')", 'saved courses after reload');
  const saved = await evaluate("window.dashboard.load()");
  if (saved.workspace.internships.internships.length !== 1 || !saved.workspace.dashboardSettings.keywords.includes('Quiz')) throw new Error('Persistence verification failed');
  if (saved.workspace.dashboardSettings.creditPlan?.requirements[0]?.name !== 'Core requirements' || !saved.workspace.academic.collections['University/Dashboard Notes'].some((n: Record<string, unknown>) => n['University/Markdown'] === '# Smoke note\n\n**bold** text\n\n- Task')) throw new Error('Notes or credits did not persist');
  await waitFor("document.querySelectorAll('.timeline-chart .recharts-line').length === 2", 'two cumulative chart lines');
  await waitFor("document.querySelectorAll('.contribution-grid .heat-square').length > 360", 'annual activity heatmap');
  await click('Edit layout');
  await waitFor("!!document.querySelector('.layout-editing')", 'dashboard layout edit mode');
  await evaluate("document.querySelector('button[aria-label=\"Move Schedule\"]').dispatchEvent(new DragEvent('dragstart', {bubbles:true,dataTransfer:new DataTransfer()}))");
  await evaluate("(() => { const el = document.querySelector('[data-widget=tasks]'), r = el.getBoundingClientRect(); el.dispatchEvent(new DragEvent('dragover', {bubbles:true,cancelable:true,dataTransfer:new DataTransfer(),clientX:r.right-5,clientY:r.top+r.height/2})); })()");
  await waitFor("!!document.querySelector('[data-widget=tasks].dock-right')", 'side-by-side drop indicator');
  await evaluate("document.querySelector('[data-widget=tasks]').dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:new DataTransfer()}))");
  await waitFor("document.querySelector('[data-widget=calendar]')?.style.getPropertyValue('--widget-span') === '6'", 'calendar docked alongside tasks');
  await evaluate("document.querySelector('button[aria-label=\"Resize Tasks width\"]').dispatchEvent(new KeyboardEvent('keydown', {bubbles:true,key:'ArrowLeft'}))");
  await waitFor("document.querySelector('[data-widget=tasks]')?.style.getPropertyValue('--widget-span') === '5'", 'keyboard widget width resizing');
  await evaluate("document.querySelector('button[aria-label=\"Resize Tasks width\"]').scrollIntoView({block:'center'})");
  const grip = await evaluate("(() => { const r=document.querySelector('button[aria-label=\"Resize Tasks width\"]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()");
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: grip.x, y: grip.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: grip.x, y: grip.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: grip.x + 120, y: grip.y, button: 'left', buttons: 1 });
  await waitFor("document.querySelector('[data-widget=tasks]')?.style.getPropertyValue('--widget-span') === '6'", 'pointer width resize preview');
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: grip.x + 120, y: grip.y, button: 'left', clickCount: 1 });
  await waitFor("!document.querySelector('button[aria-label=\"Resize Tasks width\"]')?.disabled", 'pointer width resize saved');
  if (await evaluate("!!document.querySelector('[data-widget=tasks] .widget-body')?.style.maxHeight")) throw new Error('Width resize unexpectedly assigned a widget height');
  await click('Pin height of Tasks');
  await waitFor("document.querySelector('[data-widget=tasks] .widget-body')?.style.maxHeight === '400px'", 'explicit widget height pin');
  await click('Move Overdue up');
  await waitFor("document.querySelectorAll('.workspace-widget')[1]?.getAttribute('data-widget') === 'overdue'", 'dashboard stat movement');
  await click('Finish editing layout');
  await reloadPage();
  await waitFor("document.querySelector('[data-widget=calendar]')?.style.getPropertyValue('--widget-span') === '6' && document.querySelector('[data-widget=tasks] .widget-body')?.style.maxHeight === '400px'", 'layout sizes persisted after reload');
  const preferences = await evaluate("window.dashboard.load()");
  if (preferences.workspace.dashboardSettings.layouts.internships[2].id !== 'rejected' || preferences.workspace.dashboardSettings.layouts.dashboard[1].id !== 'overdue') throw new Error('Tab layouts were not independently saved');
  const pair = await evaluate("(() => {const a=document.querySelector('[data-widget=tasks]').getBoundingClientRect(), b=document.querySelector('[data-widget=calendar]').getBoundingClientRect(); return {topA:a.top,topB:b.top,rightA:a.right,leftB:b.left};})()");
  if (Math.abs(pair.topA - pair.topB) > 1 || pair.rightA > pair.leftB) throw new Error('Docked widgets overlap or are not side by side: ' + JSON.stringify(pair));
  await click('Edit layout');
  await click('Reset layout');
  await waitFor("document.querySelector('[data-widget=tasks]')?.style.getPropertyValue('--widget-span') === '12' && !document.querySelector('[data-widget=tasks] .widget-body')?.style.maxHeight", 'default layout restored');
  await click('Finish editing layout');
  if (exceptions.length) throw new Error(exceptions.join('\n'));
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await send('Page.bringToFront');
  await evaluate("document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))");
  await Bun.sleep(300);
  for (const [width, height] of [[1600, 900], [1440, 900], [1280, 800]] as const) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await evaluate("document.querySelector('main').scrollTo(0,0)");
    await Bun.sleep(150);
    const layout = await evaluate("({width: innerWidth, heading: document.querySelector('h1').getBoundingClientRect().toJSON(), color: getComputedStyle(document.querySelector('h1')).color, overflow: document.querySelector('main').scrollWidth > document.querySelector('main').clientWidth})");
    if (layout.heading.width <= 0 || layout.overflow) throw new Error('Invalid dashboard layout: ' + JSON.stringify(layout));
    const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await Bun.write(path.join(root, 'artifacts', 'ui-dashboard-' + width + 'x' + height + '.png'), Buffer.from(screenshot.data, 'base64'));
    if (width === 1600) await Bun.write(path.join(root, 'artifacts', production ? 'ui-production.png' : 'ui-development.png'), Buffer.from(screenshot.data, 'base64'));
  }
  await evaluate("document.querySelector('.timeline-panel').scrollIntoView({block:'start'})");
  await Bun.sleep(200);
  const analytics = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await Bun.write(path.join(root, 'artifacts', 'ui-analytics.png'), Buffer.from(analytics.data, 'base64'));
  await click('Edit layout');
  await evaluate("document.querySelector('main').scrollTo(0,0)");
  await Bun.sleep(100);
  const editing = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await Bun.write(path.join(root, 'artifacts', 'ui-edit-layout.png'), Buffer.from(editing.data, 'base64'));
  await click('Finish editing layout');
  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 1, mobile: false });
  await Bun.sleep(150);
  if (await evaluate("document.querySelector('main').scrollWidth > document.querySelector('main').clientWidth")) throw new Error('Narrow split layout overflows the main window');
  const narrow = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await Bun.write(path.join(root, 'artifacts', 'ui-narrow-layout.png'), Buffer.from(narrow.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 700, height: 900, deviceScaleFactor: 1, mobile: false });
  await Bun.sleep(150);
  if (await evaluate("document.querySelector('main').scrollWidth > document.querySelector('main').clientWidth")) throw new Error('Single-column responsive layout overflows');
  await send('Emulation.clearDeviceMetricsOverride');
  console.log('PASS: Electron render/isolation; task/date/completion; one-time event persistence; recurring series create/edit/delete; duration blocks; time-cell prefill; week/day now line; charts/heatmaps; widget layout persistence; notes/credits; internship outcomes.');
} finally {
  socket?.close();
  if (electron) { electron.kill(); await electron.exited; }
  await vite?.close(); await data?.close();
  // Only remove the exact directory returned by mkdtemp, never the workspace.
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
