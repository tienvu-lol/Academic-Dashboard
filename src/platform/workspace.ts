import { useSyncExternalStore } from "react";
import {
  configureAcademicStorage,
  emptyAcademicData,
  readAcademicData,
  validateAcademicData,
  type AcademicData,
} from "../data/academic";
import { emptyDatabase, parseDatabase, type InternshipDatabase } from "../internships/model";
import { DEFAULT_PREFS, type Preferences } from "../dashboard";
import { BunSqlWorkspaceRepository, type WorkspaceRepository } from "./database";

export interface Workspace {
  format: "academic-dashboard-workspace";
  version: 2;
  academic: AcademicData;
  internships: InternshipDatabase;
  preferences: Preferences;
}

type WorkspaceState = {
  ready: boolean;
  busy: boolean;
  error: string;
  notice: string;
  data: Workspace;
};

const empty = (): Workspace => ({
  format: "academic-dashboard-workspace",
  version: 2,
  academic: emptyAcademicData(),
  internships: emptyDatabase(),
  preferences: { ...DEFAULT_PREFS },
});

let repository: WorkspaceRepository = new BunSqlWorkspaceRepository();
let state: WorkspaceState = { ready: false, busy: false, error: "", notice: "", data: empty() };
let rawAcademic = JSON.stringify(state.data.academic);
const listeners = new Set<() => void>();

export function configureWorkspaceRepository(next: WorkspaceRepository) {
  repository = next;
  state = { ready: false, busy: false, error: "", notice: "", data: empty() };
  rawAcademic = JSON.stringify(state.data.academic);
  bindAcademic();
}

function bindAcademic() {
  configureAcademicStorage({
    read: () => rawAcademic,
    write: (value) => { rawAcademic = value; },
  });
}
bindAcademic();

function publish(next: Partial<WorkspaceState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function getWorkspaceState() {
  return state;
}

export function useWorkspace() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    () => state,
  );
}

export function validateWorkspace(value: unknown): asserts value is Workspace {
  const data = value as Workspace;
  if (data?.format !== "academic-dashboard-workspace" || data.version !== 2)
    throw new Error("Unsupported workspace backup format.");
  validateAcademicData(data.academic);
  parseDatabase(JSON.stringify(data.internships));
  if (!data.preferences || Object.keys(DEFAULT_PREFS).some(
    (key) => typeof data.preferences[key as keyof Preferences] !== "boolean",
  )) throw new Error("Invalid dashboard preferences.");
  data.preferences.showCalendar = false;
}

export function parseWorkspace(value: unknown): Workspace {
  const candidate = value as Record<string, unknown>;
  if (candidate?.format === "academic-dashboard-windows" && candidate.version === 1) {
    const migrated = { ...candidate, format: "academic-dashboard-workspace", version: 2 } as Workspace;
    validateWorkspace(migrated);
    return migrated;
  }
  validateWorkspace(value);
  return value;
}

export async function initialize() {
  if (state.busy) return;
  publish({ busy: true, error: "" });
  try {
    await repository.initialize();
    const data = (await repository.load()) ?? empty();
    validateWorkspace(data);
    rawAcademic = JSON.stringify(data.academic);
    bindAcademic();
    publish({ data, ready: true, notice: "Bun SQL workspace ready." });
  } catch (error) {
    publish({ error: `Could not open the Bun SQL workspace. ${String(error)}`, ready: false });
  } finally {
    publish({ busy: false });
  }
}

export async function transact(
  change: (draft: Workspace) => void | Promise<void>,
  notice = "Saved to Bun SQL.",
): Promise<boolean> {
  if (!state.ready || state.busy) return false;
  const previous = state.data;
  publish({ busy: true, error: "", notice: "" });
  try {
    const draft = structuredClone(previous);
    rawAcademic = JSON.stringify(draft.academic);
    bindAcademic();
    await change(draft);
    draft.academic = readAcademicData();
    validateWorkspace(draft);
    await repository.save(draft);
    publish({ data: draft, notice });
    return true;
  } catch (error) {
    rawAcademic = JSON.stringify(previous.academic);
    bindAcademic();
    publish({ error: `Your change was not saved. ${String(error)}` });
    return false;
  } finally {
    publish({ busy: false });
  }
}

export function reportError(error: unknown) {
  publish({ error: String(error) });
}

export function storagePath() {
  return repository.location;
}

export async function exportWorkspace() {
  try {
    const path = `${repository.location}.backup.json`;
    await Bun.write(path, JSON.stringify(state.data, null, 2));
    publish({ notice: `Backup exported to ${path}` });
    return path;
  } catch (error) {
    reportError(error);
    return null;
  }
}
