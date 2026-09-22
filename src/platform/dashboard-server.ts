import { BunSqlWorkspaceRepository } from './database';
import { emptyWorkspace, validateDashboardWorkspace, ensureDailyNote } from '../data/planning';

export async function startDashboardServer(filename?: string) {
  const repository = new BunSqlWorkspaceRepository(filename);
  await repository.initialize();
  let workspace = await repository.load() ?? emptyWorkspace();
  validateDashboardWorkspace(workspace);
  let revision = 0;
  let queue = Promise.resolve();
  const token = crypto.randomUUID();
  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0, maxRequestBodySize: 16 * 1024 * 1024,
    async fetch(request) {
      if (request.headers.get('authorization') !== 'Bearer ' + token || request.headers.has('origin')) return new Response('Forbidden', { status: 403 });
      if (new URL(request.url).pathname !== '/workspace') return new Response('Not found', { status: 404 });
      if (request.method === 'GET') {
        const update = queue.then(async () => {
          const next = structuredClone(workspace);
          if (ensureDailyNote(next)) { await repository.save(next); workspace = next; revision += 1; }
        });
        queue = update.catch(() => {});
        try { await update; return Response.json({ workspace, revision }); }
        catch { return Response.json({ error: 'Could not create today’s note. Existing data is unchanged.' }, { status: 500 }); }
      }
      if (request.method === 'POST' && new URL(request.url).pathname === '/workspace/prioritize') {
        const apiKey = Bun.env.TYPESAFE_API_KEY;
        if (!apiKey) return Response.json({ error: 'TYPESAFE_API_KEY not configured.' }, { status: 400 });
        const update = queue.then(async () => {
          const { TypeSafeClient, score } = await import('@typesafe-ai/sdk');
          const client = new TypeSafeClient({ apiKey });
          const tasks = [...workspace.academic.collections['University/Assignments'], ...workspace.academic.collections['University/To-Dos']]
            .filter(t => t['Dashboard/Completed'] !== true && (t['workflow/state'] as Record<string, string> | undefined)?.['enum/name'] !== 'Done');
          if (!tasks.length) return;
          const questions: Record<string, any> = {};
          tasks.forEach(t => {
            questions[t['fibery/id']] = score(
              `What is the priority of this task? Assess urgency and importance based on typical academic expectations. High priority means it is a major assessment, exam, or has an impending deadline. Low priority means it is routine reading, a minor side task, or unscheduled.`,
              ["Low priority (routine, minor, unscheduled)", "Medium priority (standard assignment)", "High priority (major assessment, exam, urgent)"]
            );
          });
          const response = await client.systemOne({
            state: { tasks: tasks.map(t => ({ id: t['fibery/id'], title: t['University/Name'], due: (t['University/Due Date'] as string) ?? null })) },
            questions
          });
          for (const task of tasks) {
            const ans = response.answers[task['fibery/id']];
            if (ans && ans.type === 'score' && ans.score !== undefined) {
              task['Dashboard/AIPriorityScore'] = ans.score;
            }
          }
          await repository.save(workspace);
          revision += 1;
        });
        queue = update.catch(() => {});
        try { await update; return Response.json({ workspace, revision }); }
        catch (error) { return Response.json({ error: String(error) }, { status: 500 }); }
      }
      if (request.method !== 'PUT') return new Response('Method not allowed', { status: 405 });
      try {
        const body = await request.json() as { workspace: unknown; revision: number };
        validateDashboardWorkspace(body.workspace);
        let response: Response;
        const save = queue.then(async () => {
          if (body.revision !== revision) { response = Response.json({ error: 'Your workspace changed. Reload before saving again.' }, { status: 409 }); return; }
          await repository.save(body.workspace as typeof workspace);
          workspace = body.workspace as typeof workspace; revision += 1;
          response = Response.json({ workspace, revision });
        });
        queue = save.catch(() => {});
        await save;
        return response!;
      } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Could not save workspace.' }, { status: 400 }); }
    },
  });
  return { url: server.url.href + 'workspace', token, async close() { await server.stop(true); await queue; await repository.close(); } };
}
