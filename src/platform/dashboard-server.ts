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
