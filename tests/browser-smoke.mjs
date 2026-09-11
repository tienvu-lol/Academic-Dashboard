/** Optional browser smoke check. Run against pnpm dev with Chrome installed. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const base = process.env.DASHBOARD_URL || 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = path.resolve('.vite-cache', `browser-smoke-${Date.now()}`);
await mkdir(profile, {recursive: true});
const browser = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--remote-debugging-port=9333', `--user-data-dir=${profile}`, 'about:blank'], {windowsHide: true, stdio: 'ignore'});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let target;
  for (let i = 0; i < 60; i++) {
    try {target = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(item => item.type === 'page'); if (target) break;} catch {}
    await delay(200);
  }
  assert.ok(target, 'Chrome debugging target starts');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
  let seq = 0;
  const pending = new Map();
  const exceptions = [];
  const requests = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id); pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
  };
  function send(method, params = {}) {return new Promise((resolve, reject) => {const id = ++seq; pending.set(id, {resolve, reject}); socket.send(JSON.stringify({id, method, params}));});}
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.result.description);
    return result.result.value;
  }
  async function until(expression, message) {
    for (let i = 0; i < 100; i++) {
      try {if (await evaluate(expression)) return;} catch (error) {if (!/context|navigat/i.test(error.message)) throw error;}
      await delay(100);
    }
    throw new Error(`Timed out: ${message}`);
  }
  async function click(text) {
    assert.equal(await evaluate(`(() => {const el = [...document.querySelectorAll('button,a')].find(el => el.textContent.trim() === ${JSON.stringify(text)} && el.getClientRects().length); if (!el) return false; el.click(); return true;})()`), true, `Button/link exists: ${text}`);
    await delay(180);
  }
  async function fill(label, value) {
    assert.equal(await evaluate(`(() => {const label = [...document.querySelectorAll('label')].find(el => el.textContent.trim().startsWith(${JSON.stringify(label)})); const el = label?.querySelector('input,textarea,select'); if (!el) return false; const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true})); return true;})()`), true, `Field exists: ${label}`);
    await delay(80);
  }
  async function snapshot(name) {
    const shot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    await writeFile(path.join(profile, `${name}.png`), Buffer.from(shot.data, 'base64'));
  }
  await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1060, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: base});
  await until(`document.querySelector('h1')?.textContent.includes('Good')`, 'Academic page renders');
  await until(`document.querySelectorAll('.metric-card').length === 4`, 'Metrics render');
  assert.equal(await evaluate(`getComputedStyle(document.body).backgroundColor`), 'rgb(32, 28, 26)', 'Fibery dark background restored');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.metric-card')).backgroundColor`), 'rgb(39, 35, 33)', 'Cards use the warm dark palette');
  assert.ok(await evaluate(`document.querySelectorAll('svg.lucide').length > 10`), 'Bundled icons render');
  await snapshot('academic-desktop');

  await click('Add item');
  await until(`!!document.querySelector('[role="dialog"]')`, 'Quick add opens');
  await fill('Assignment name', 'Browser smoke assignment');
  await click('Add Assignment');
  await until(`!document.querySelector('[role="dialog"]')`, 'Assignment saves');
  await until(`document.body.textContent.includes('Browser smoke assignment')`, 'Assignment shown');
  await evaluate(`window.__smokeReloadMarker = true`);
  await send('Page.reload');
  await until(`!window.__smokeReloadMarker && document.body?.textContent.includes('Browser smoke assignment')`, 'Local assignment survives reload');
  await evaluate(`document.querySelector('button[aria-label="Settings"]').click()`);
  await until(`!!document.querySelector('[role="dialog"]')`, 'Settings opens');
  assert.ok(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('Google Calendar import is disabled')`));
  await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
  await until(`!document.querySelector('[role="dialog"]')`, 'Escape closes modal');

  await evaluate(`location.hash = 'internships'`);
  await until(`document.querySelector('h1')?.textContent.toLowerCase().includes('internship')`, 'Internships page renders');
  await delay(500);
  await click('Add internship');
  await fill('Company', 'Example Robotics');
  await fill('Role', 'Browser intern');
  await fill('Application link', 'https://example.com/internship');
  await fill('Listed date', '2026-08-24');
  await fill('Application deadline', '2026-08-31');
  await fill('Date sent', '2026-08-28');
  await fill('Outcome', 'accepted');
  await fill('Outcome date', '2026-09-01');
  await fill('Notes', 'Preserve this manual note');
  await click('Save internship');
  await until(`!document.querySelector('[role="dialog"]')`, 'Internship saves');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('academic-dashboard.internships.v1')).internships[0].outcome`), 'accepted');
  await evaluate(`(() => {const el = document.querySelector('select[aria-label="Availability for Example Robotics Browser intern"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, 'closed'); el.dispatchEvent(new Event('change', {bubbles:true}));})()`);
  await until(`JSON.parse(localStorage.getItem('academic-dashboard.internships.v1')).internships[0].availability === 'closed'`, 'Manual availability saves');
  await click('Import');
  await fill('Or paste file contents', 'Company,Role,URL,Listed Date\nExample Robotics,Browser intern,https://example.com/internship,2026-08-24\nExample Research,Research intern,https://example.com/research,2026-08-26');
  await click('Preview import');
  await until(`document.querySelector('[role="dialog"]').textContent.includes('1 new')`, 'Import preview detects duplicate');
  await click('Import 1 new');
  await until(`!document.querySelector('[role="dialog"]')`, 'Import commits');
  await evaluate(`window.__smokeReloadMarker = true`);
  await send('Page.reload');
  await until(`!window.__smokeReloadMarker && document.querySelector('h1')?.textContent.toLowerCase().includes('internship')`, 'Internships reload');
  assert.deepEqual(await evaluate(`(() => {const items = JSON.parse(localStorage.getItem('academic-dashboard.internships.v1')).internships; return {count: items.length, outcome: items[0].outcome, availability: items[0].availability, notes: items[0].notes};})()`), {count: 2, outcome: 'accepted', availability: 'closed', notes: 'Preserve this manual note'}, 'Import and reload preserve manual progress');
  await delay(300);
  await snapshot('internships-desktop');
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await delay(200);
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), 'Internship page fits mobile viewport');
  await snapshot('internships-mobile');
  await evaluate(`location.hash = 'data'`);
  await until(`document.querySelector('h1')?.textContent.toLowerCase().includes('import')`, 'Data import page renders');
  const courseFile = path.join(profile, 'courses.csv');
  await writeFile(courseFile, 'Name,Credits,Term\nBrowser course,3,Fall 2026');
  const {root} = await send('DOM.getDocument');
  const {nodeId} = await send('DOM.querySelector', {nodeId: root.nodeId, selector: 'input[type="file"]'});
  await send('DOM.setFileInputFiles', {nodeId, files: [courseFile]});
  await until(`document.body.textContent.includes('1 new records')`, 'Fibery file import preview');
  await click('Import 1 records');
  await until(`document.body.textContent.includes('Imported 1 record')`, 'Fibery import committed');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('academic-dashboard.academic.v1')).collections['University/Courses'][0]['University/Credit Hours']`), 3);
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), 'Import page fits mobile viewport');
  await snapshot('imports-mobile');
  await evaluate(`location.hash = 'academic'`);
  await until(`document.querySelector('h1')?.textContent.includes('Good')`, 'Academic page renders on mobile');
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), 'Academic page fits mobile viewport');
  await snapshot('academic-mobile');
  assert.deepEqual(exceptions, [], 'No uncaught browser exceptions');
  assert.deepEqual(requests.filter(url => /^https?:/.test(url) && !url.startsWith(base)), [], 'No external data requests');
  console.log(JSON.stringify({passed: true, screenshots: profile, assertions: 'Dark theme, bundled icons, local assignment create/reload, internship outcome and availability editing, duplicate-safe import, Fibery file preview/commit, modal Escape, sidebar pages, mobile overflow, no external requests or uncaught errors'}, null, 2));
} finally {
  socket?.close();
  browser.kill();
}
