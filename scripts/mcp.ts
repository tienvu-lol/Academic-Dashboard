import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { layoutFor, moveWidget } from "../src/data/layout";
import { setTaskCompleted, settingsFor, tasksFor } from "../src/data/planning";

const mcpConfigDir = path.join(os.homedir(), '.academic-dashboard');
const serverJsonPath = path.join(mcpConfigDir, 'server.json');

async function getLiveServer() {
  if (!fs.existsSync(serverJsonPath)) throw new Error("Academic Dashboard is not currently running. Please launch the desktop app first.");
  const data = JSON.parse(fs.readFileSync(serverJsonPath, 'utf8'));
  return data as { url: string; token: string };
}

async function getWorkspace() {
  const { url, token } = await getLiveServer();
  const getRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!getRes.ok) throw new Error("Failed to load workspace from running application.");
  return await getRes.json();
}

async function mutateWorkspace(callback: (workspace: any) => void) {
  const snapshot = await getWorkspace();
  callback(snapshot.workspace);
  snapshot.workspace.academic.updatedAt = new Date().toISOString();

  const { url, token } = await getLiveServer();
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot)
  });
  if (!putRes.ok) throw new Error("Failed to save workspace to running application.");
  return putRes.json();
}

const server = new McpServer({
  name: "Academic Dashboard",
  version: "1.0.0",
});

server.tool(
  "dashboard_get_state",
  "Returns the current state of the academic dashboard including active tasks, courses, and internships.",
  {},
  async () => {
    try {
      const { workspace } = await getWorkspace();
      const tasks = [...workspace.academic.collections['University/Assignments'], ...workspace.academic.collections['University/To-Dos']]
            .filter((t: any) => t['Dashboard/Completed'] !== true && t['workflow/state']?.['enum/name'] !== 'Done')
            .map((t: any) => ({
              id: t['fibery/id'],
              title: t['University/Name'],
              due: t['University/Due Date'],
              priority: t['University/Priority']?.['enum/name']
            }));
      const summary = {
        activeTasks: tasks,
        layouts: workspace.dashboardSettings?.layouts || {}
      };
      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    } catch (e) { return { isError: true, content: [{ type: "text", text: String(e) }] }; }
  }
);

server.tool(
  "tasks_create",
  "Creates a new academic task on the dashboard.",
  {
    title: z.string().describe("Title of the task"),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Due date in YYYY-MM-DD format (optional)"),
    priority: z.enum(["Low", "Medium", "High"]).optional().describe("Task priority (optional)"),
  },
  async ({ title, due_date, priority }) => {
    try {
      await mutateWorkspace((workspace) => {
        const id = crypto.randomUUID();
        const options = workspace.academic.options['University/Priority'] ??= [];
        const priorityName = priority ?? 'Medium';
        let priorityOption = options.find((option: { name: string }) => option.name === priorityName);
        if (!priorityOption) {
          priorityOption = { id: crypto.randomUUID(), name: priorityName };
          options.push(priorityOption);
        }
        workspace.academic.collections['University/Assignments'].push({
          'fibery/id': id,
          'University/Name': title,
          'University/Due Date': due_date || null,
          'University/Priority': { 'fibery/id': priorityOption.id },
          'Dashboard/Completed': false
        });
      });
      return { content: [{ type: "text", text: `Task created successfully: ${title}` }] };
    } catch (e) { return { isError: true, content: [{ type: "text", text: String(e) }] }; }
  }
);

server.tool(
  "tasks_complete",
  "Marks an academic task as completed.",
  {
    id: z.string().describe("The fibery/id of the task to complete"),
  },
  async ({ id }) => {
    try {
      await mutateWorkspace((workspace) => {
        const task = tasksFor(workspace).find(item => item.id === id);
        if (!task) throw new Error(`Task not found: ${id}`);
        setTaskCompleted(workspace, task, true);
      });
      return { content: [{ type: "text", text: `Task completed successfully.` }] };
    } catch (e) { return { isError: true, content: [{ type: "text", text: String(e) }] }; }
  }
);

server.tool(
  "dashboard_move_widget",
  "Moves a dashboard widget to a new position.",
  {
    widget_id: z.string().describe("The ID of the widget (e.g. tasks, calendar, timeline)"),
    column: z.number().int().min(1).max(12).describe("The new column position (1-12)"),
    row: z.number().int().min(1).max(100).describe("The new row position (1-100)"),
  },
  async ({ widget_id, column, row }) => {
    try {
      await mutateWorkspace((workspace) => {
        const settings = settingsFor(workspace);
        const layout = layoutFor('dashboard', settings.layouts);
        if (!layout.some(item => item.id === widget_id)) throw new Error(`Unknown dashboard widget: ${widget_id}`);
        workspace.dashboardSettings = {
          ...settings,
          layouts: { ...settings.layouts, dashboard: moveWidget(layout, widget_id, column, row) }
        };
      });
      return { content: [{ type: "text", text: `Widget ${widget_id} moved successfully.` }] };
    } catch (e) { return { isError: true, content: [{ type: "text", text: String(e) }] }; }
  }
);

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch(console.error);
