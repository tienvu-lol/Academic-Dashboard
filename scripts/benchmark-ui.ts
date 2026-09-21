// Repeatable production Electron benchmark for startup and page-switch rendering.
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildElectronMain, spawnElectron } from './electron-runtime';
import { startDashboardServer } from '../src/platform/dashboard-server';
import { BunSqlWorkspaceRepository } from '../src/platform/database';
import { emptyWorkspace } from '../src/data/planning';
import { todayLocal } from '../src/internships/model';

const root = path.resolve(import.meta.dir, '..');
const temporary = await mkdtemp(path.join(tmpdir(), 'academic-ui-benchmark-'));
const samples = Math.max(3, Number(process.argv.find(value => value.startsWith('--samples='))?.split('=')[1] ?? 5));
const stage = process.argv.find(value => value.startsWith('--stage='))?.split('=')[1] ?? 'unnamed';
type Metric = 'rendererReady' | 'processReady' | 'dashboardToNotes' | 'notesToDashboard' | 'dashboardToInternships' | 'internshipsToDashboard' | 'dashboardToNotesWarm' | 'notesToDashboardWarm' | 'dashboardToInternshipsWarm' | 'internshipsToDashboardWarm';
const results: Record<Metric, number[]> = {
  rendererReady: [], processReady: [], dashboardToNotes: [], notesToDashboard: [],
  dashboardToInternships: [], internshipsToDashboard: [],
  dashboardToNotesWarm: [], notesToDashboardWarm: [],
  dashboardToInternshipsWarm: [], internshipsToDashboardWarm: [],
};

async function until<T>(get: () => Promise<T>, label: string, timeout = 20000): Promise<NonNullable<T>> {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    const result = await get();
    if (result) return result as NonNullable<T>;
    await Bun.sleep(25);
  }
  throw new Error('Timed out: ' + label);
}

class DevTools {
  private socket?: WebSocket;
  private sequence = 0;
  private pending = new Map<number, { resolve(value: any): void; reject(error: Error): void }>();

  async connect(profile: string) {
    const port = await until(async () => {
      try { return (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
      catch { return ''; }
    }, 'Electron debugging endpoint');
    const target = await until(async () => {
      const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json() as { type: string; webSocketDebuggerUrl: string }[];
      return pages.find(page => page.type === 'page');
    }, 'renderer target');
    this.socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      this.socket!.onopen = () => resolve();
      this.socket!.onerror = () => reject(new Error('CDP connection failed'));
    });
    this.socket.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const request = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) request?.reject(new Error(message.error.message));
      else request?.resolve(message.result);
    };
    await this.send('Runtime.enable');
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP timeout: ' + method));
      }, 15000);
      this.pending.set(id, {
        resolve: value => { clearTimeout(timeout); resolve(value); },
        reject: error => { clearTimeout(timeout); reject(error); },
      });
      this.socket!.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const result = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true, userGesture: true,
    });
    if (result.exceptionDetails) throw new Error(expression + '\n' + JSON.stringify(result.exceptionDetails));
    return result.result.value as T;
  }

  close() { this.socket?.close(); }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function switchExpression(label: string, selector: string) {
  return `new Promise((resolve, reject) => {
    const button = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === ${JSON.stringify(label)});
    if (!button) return reject(new Error('Missing navigation button'));
    const start = performance.now();
    button.click();
    const check = () => {
      if (document.querySelector(${JSON.stringify(selector)})) {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)));
      } else requestAnimationFrame(check);
    };
    check();
  })`;
}

async function stop(process: Awaited<ReturnType<typeof spawnElectron>>) {
  process.kill();
  await Promise.race([process.exited, Bun.sleep(3000)]);
}

let data: Awaited<ReturnType<typeof startDashboardServer>> | undefined;
try {
  await Bun.$`bun run build:renderer`.cwd(root).quiet();
  await buildElectronMain();
  const databaseFile = path.join(temporary, 'workspace.sqlite');
  const repository = new BunSqlWorkspaceRepository(databaseFile);
  await repository.initialize();
  const workspace = emptyWorkspace();
  workspace.academic.collections['University/Assignments'].push({
    'fibery/id': 'benchmark-task',
    'University/Name': 'Benchmark assignment',
    'University/Due Date': todayLocal(),
  });
  await repository.save(workspace);
  await repository.close();
  data = await startDashboardServer(databaseFile);

  for (let index = 0; index < samples; index++) {
    const profile = path.join(temporary, 'profile-' + index);
    await mkdir(profile, { recursive: true });
    const processStarted = performance.now();
    const electron = await spawnElectron({
      DASHBOARD_DATA_URL: data.url,
      DASHBOARD_DATA_TOKEN: data.token,
    }, [
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0',
      '--disable-features=CalculateNativeWinOcclusion',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--user-data-dir=' + profile,
    ]);
    const tools = new DevTools();
    try {
      await tools.connect(profile);
      await until(() => tools.evaluate<boolean>("!!document.querySelector('.widget-grid') && document.body.textContent.includes('Benchmark assignment')"), 'workspace ready');
      results.processReady.push(performance.now() - processStarted);
      results.rendererReady.push(await tools.evaluate<number>('performance.now()'));
      results.dashboardToNotes.push(await tools.evaluate<number>(switchExpression('Daily notes', '.page-daily-notes .notes-layout')));
      results.notesToDashboard.push(await tools.evaluate<number>(switchExpression('Dashboard', '.page-dashboard .widget-grid')));
      results.dashboardToInternships.push(await tools.evaluate<number>(switchExpression('Internships', '.page-internships .widget-grid')));
      results.internshipsToDashboard.push(await tools.evaluate<number>(switchExpression('Dashboard', '.page-dashboard .widget-grid')));
      results.dashboardToNotesWarm.push(await tools.evaluate<number>(switchExpression('Daily notes', '.page-daily-notes .notes-layout')));
      results.notesToDashboardWarm.push(await tools.evaluate<number>(switchExpression('Dashboard', '.page-dashboard .widget-grid')));
      results.dashboardToInternshipsWarm.push(await tools.evaluate<number>(switchExpression('Internships', '.page-internships .widget-grid')));
      results.internshipsToDashboardWarm.push(await tools.evaluate<number>(switchExpression('Dashboard', '.page-dashboard .widget-grid')));
    } finally {
      tools.close();
      await stop(electron);
    }
  }
  const summary = Object.fromEntries(Object.entries(results).map(([name, values]) => [
    name,
    { medianMs: Number(median(values).toFixed(2)), samplesMs: values.map(value => Number(value.toFixed(2))) },
  ]));
  console.log(JSON.stringify({
    stage,
    sampleCount: samples,
    measuredAt: new Date().toISOString(),
    definition: 'Startup is process/renderer navigation start to workspace-ready DOM; switches resolve after target DOM plus two animation frames.',
    metrics: summary,
  }, null, 2));
} finally {
  await data?.close();
  await rm(temporary, { recursive: true, force: true });
}
