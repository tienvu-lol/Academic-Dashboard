# MCP Server Architecture

## Purpose

The Academic Dashboard exposes a local Model Context Protocol (MCP) server so external clients such as Claude Code and Cursor can read and update the workspace while the desktop app remains the authoritative UI and persistence process.

## Process Boundary

1. `src/platform/dashboard-server.ts` owns the SQLite-backed workspace and listens only on an ephemeral `127.0.0.1` port.
2. On startup it writes `~/.academic-dashboard/server.json` containing the authenticated `/workspace` URL and a per-process bearer token.
3. `scripts/mcp.ts` runs as a standard MCP `stdio` server. It reads that connection file and proxies typed MCP tools to the live dashboard service.
4. External clients launch the bridge with `bun run mcp` while the Academic Dashboard desktop application is running.
5. The desktop main process subscribes to `/workspace/events`. Successful MCP mutations increment the workspace revision, persist through the existing repository, emit an SSE notification, and cause the renderer to reload through the preload bridge.

The MCP bridge does not access SQLite directly. All reads and writes continue through the authenticated dashboard service, preserving validation, revision conflict detection, and one authoritative workspace process.

## Exposed Tools

- `dashboard_get_state` — returns active tasks and saved dashboard layouts.
- `tasks_create` — creates an assignment with an optional due date and priority.
- `tasks_complete` — completes a task using the existing domain completion behavior.
- `dashboard_move_widget` — moves a known dashboard widget through the existing collision-safe layout engine.

Internship and calendar mutation tools are not implemented in this initial bridge.

## Security

- The service binds to loopback only.
- Every HTTP and SSE request requires the random bearer token.
- Requests carrying an `Origin` header are rejected, preventing browser pages from calling the local service.
- The token is regenerated for each application process and the connection file is removed during a clean shutdown.
- Electron retains context isolation, sandboxing, and a narrow preload API.

## State Synchronization

`/workspace/events` is an authenticated SSE endpoint. Each persisted revision emits an event. Electron forwards those notifications as `workspace:update`; `useDashboard` reloads the latest snapshot and unregisters its listener when the component unmounts.

## Client Configuration

Start the desktop app first, then configure an MCP client to run:

```json
{
  "command": "bun",
  "args": ["run", "mcp"],
  "cwd": "C:/Users/tient/OneDrive/Desktop/Academic Dashboard"
}
```

## Verification

A live protocol smoke test starts an isolated dashboard service and MCP client, discovers all four tools, creates and completes a task, moves the Tasks widget, confirms persistence, and confirms an SSE update is emitted. The normal project typecheck, lint, unit tests, and production build must also pass before release.
