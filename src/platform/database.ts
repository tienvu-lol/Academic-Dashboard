import { SQL } from "bun";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { ACADEMIC_TYPES, validateAcademicData, type AcademicData, type AcademicType, type Entity, type DocumentContentJson, type LocalOption } from "../data/academic";
import { parseDatabase, type Internship, type InternshipDatabase } from "../internships/model";
import type { Preferences } from "../dashboard";
import type { Workspace } from "./workspace";
import { eventsFor, validateCalendarEvents, type CalendarEvent } from '../data/calendar';

type JsonRow = { key: string; value: string };
type AcademicRow = { collection: AcademicType; payload: string };
type PayloadRow = { payload: string };

export interface WorkspaceRepository {
  readonly location: string;
  initialize(): Promise<void>;
  load(): Promise<Workspace | null>;
  save(workspace: Workspace): Promise<void>;
  close(): Promise<void>;
}

export function defaultDatabasePath(): string {
  if (Bun.env.ACADEMIC_DASHBOARD_DATABASE)
    return Bun.env.ACADEMIC_DASHBOARD_DATABASE;
  const root = Bun.env.LOCALAPPDATA || Bun.env.XDG_DATA_HOME || Bun.env.HOME || ".";
  return join(root, "AcademicDashboard", "academic-dashboard.sqlite");
}

export class BunSqlWorkspaceRepository implements WorkspaceRepository {
  readonly location: string;
  private readonly sql: SQL;

  constructor(filename = defaultDatabasePath()) {
    this.location = filename;
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.sql = new SQL({
      adapter: "sqlite",
      filename,
      create: true,
      readwrite: true,
      strict: true,
    });
  }

  async initialize() {
    await this.sql`PRAGMA foreign_keys = ON`;
    await this.sql`PRAGMA journal_mode = WAL`;
    await this.sql`
      CREATE TABLE IF NOT EXISTS workspace_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS academic_entities (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS academic_entities_collection
      ON academic_entities (collection)
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS academic_documents (
        secret TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS academic_options (
        field TEXT NOT NULL,
        id TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (field, id)
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS internships (
        id TEXT PRIMARY KEY,
        company TEXT NOT NULL,
        role TEXT NOT NULL,
        applied_date TEXT NOT NULL,
        outcome TEXT NOT NULL,
        payload TEXT NOT NULL
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS internships_outcome
      ON internships (outcome, applied_date)
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        payload TEXT NOT NULL
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS calendar_events_range
      ON calendar_events (start_date, end_date)
    `;
  }

  async load(): Promise<Workspace | null> {
    const metaRows = (await this.sql`SELECT key, value FROM workspace_meta`) as JsonRow[];
    if (!metaRows.length) return null;
    const meta = new Map(metaRows.map((row) => [row.key, row.value]));
    const entityRows = (await this.sql`
      SELECT collection, payload FROM academic_entities ORDER BY rowid
    `) as AcademicRow[];
    const documentRows = (await this.sql`
      SELECT secret AS key, payload AS value FROM academic_documents
    `) as JsonRow[];
    const optionRows = (await this.sql`
      SELECT field AS key, payload AS value FROM academic_options ORDER BY rowid
    `) as JsonRow[];
    const internshipRows = (await this.sql`
      SELECT payload FROM internships ORDER BY rowid
    `) as PayloadRow[];
    const eventRows = (await this.sql`
      SELECT payload FROM calendar_events ORDER BY rowid
    `) as PayloadRow[];

    const collections = Object.fromEntries(
      ACADEMIC_TYPES.map((type) => [type, [] as Entity[]]),
    ) as AcademicData["collections"];
    for (const row of entityRows) collections[row.collection].push(JSON.parse(row.payload));
    const documents: Record<string, DocumentContentJson> = {};
    for (const row of documentRows) documents[row.key] = JSON.parse(row.value);
    // Empty option lists have no table rows; retain their keys across restarts.
    const optionFields: string[] = JSON.parse(meta.get('academic.optionFields') ?? '[]');
    const options: Record<string, LocalOption[]> = Object.fromEntries(
      [...new Set([...optionFields, 'University/Category', 'University/Priority', 'workflow/state'])].map(field => [field, []]),
    );
    for (const row of optionRows) (options[row.key] ??= []).push(JSON.parse(row.value));

    const academic: AcademicData = {
      format: "academic-dashboard",
      version: 1,
      updatedAt: meta.get("academic.updatedAt") ?? new Date().toISOString(),
      collections,
      documents,
      options,
    };
    validateAcademicData(academic);
    const internships: InternshipDatabase = {
      version: 1,
      settings: JSON.parse(required(meta, "internships.settings")),
      internships: internshipRows.map((row) => JSON.parse(row.payload) as Internship),
    };
    parseDatabase(JSON.stringify(internships));
    const calendarEvents = eventRows.map(row => JSON.parse(row.payload) as CalendarEvent);
    validateCalendarEvents(calendarEvents);
    return {
      format: "academic-dashboard-workspace",
      version: 2,
      academic,
      internships,
      preferences: JSON.parse(required(meta, "preferences")) as Preferences,
      calendarEvents,
      ...(meta.has('dashboard.settings') ? { dashboardSettings: JSON.parse(required(meta, 'dashboard.settings')) } : {}),
    };
  }

  async save(workspace: Workspace) {
    const calendarEvents = eventsFor(workspace);
    validateCalendarEvents(calendarEvents);
    await this.sql.begin(async (tx) => {
      await tx`DELETE FROM workspace_meta`;
      await tx`DELETE FROM academic_entities`;
      await tx`DELETE FROM academic_documents`;
      await tx`DELETE FROM academic_options`;
      await tx`DELETE FROM internships`;
      await tx`DELETE FROM calendar_events`;

      const metadata = [
        ["format", workspace.format],
        ["version", String(workspace.version)],
        ["academic.updatedAt", workspace.academic.updatedAt],
        ["academic.optionFields", JSON.stringify(Object.keys(workspace.academic.options))],
        ["preferences", JSON.stringify(workspace.preferences)],
        ["internships.settings", JSON.stringify(workspace.internships.settings)],
        ["dashboard.settings", JSON.stringify(workspace.dashboardSettings ?? { keywords: ['Test', 'Exam'], order: ['keywords', 'priority', 'due', 'course'], courseOrder: [], internshipCategories: [], sidebarSlim: false })],
      ] as const;
      for (const [key, value] of metadata)
        await tx`INSERT INTO workspace_meta (key, value) VALUES (${key}, ${value})`;

      for (const type of ACADEMIC_TYPES)
        for (const entity of workspace.academic.collections[type])
          await tx`
            INSERT INTO academic_entities (collection, id, payload)
            VALUES (${type}, ${entity["fibery/id"]}, ${JSON.stringify(entity)})
          `;
      for (const [secret, document] of Object.entries(workspace.academic.documents))
        await tx`
          INSERT INTO academic_documents (secret, payload)
          VALUES (${secret}, ${JSON.stringify(document)})
        `;
      for (const [field, values] of Object.entries(workspace.academic.options))
        for (const option of values)
          await tx`
            INSERT INTO academic_options (field, id, payload)
            VALUES (${field}, ${option.id}, ${JSON.stringify(option)})
          `;
      for (const internship of workspace.internships.internships)
        await tx`
          INSERT INTO internships (id, company, role, applied_date, outcome, payload)
          VALUES (${internship.id}, ${internship.company}, ${internship.role}, ${internship.appliedDate}, ${internship.outcome}, ${JSON.stringify(internship)})
        `;
      for (const event of calendarEvents) {
        const startDate = event.recurrence?.startDate ?? event.date;
        const endDate = event.recurrence?.endDate ?? event.date;
        await tx`
          INSERT INTO calendar_events (id, start_date, end_date, payload)
          VALUES (${event.id}, ${startDate}, ${endDate}, ${JSON.stringify(event)})
        `;
      }
    });
  }

  async close() {
    await this.sql.close();
  }
}

function required(values: Map<string, string>, key: string): string {
  const value = values.get(key);
  if (value === undefined) throw new Error(`Database metadata is missing ${key}.`);
  return value;
}
