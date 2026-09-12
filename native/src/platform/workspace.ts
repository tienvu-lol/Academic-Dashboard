import { useSyncExternalStore } from "react";
import { NativeModules } from "react-native";
import {
  configureAcademicStorage,
  emptyAcademicData,
  readAcademicData,
  validateAcademicData,
  type AcademicData,
} from "../../../src/data/academic";
import {
  emptyDatabase,
  parseDatabase,
  type InternshipDatabase,
} from "../../../src/internships/model";
import { DEFAULT_PREFS, type Preferences } from "../../../src/dashboard";

export interface Workspace {
  format: "academic-dashboard-windows";
  version: 1;
  academic: AcademicData;
  internships: InternshipDatabase;
  preferences: Preferences;
}
interface NativeFiles {
  Read(): Promise<string>;
  Write(contents: string): Promise<void>;
  PickImport(): Promise<{ name: string; text: string } | null>;
  Export(name: string, contents: string): Promise<boolean>;
  StoragePath(): string;
}
export const files = NativeModules.WorkspaceFiles as NativeFiles;
const empty = (): Workspace => ({
  format: "academic-dashboard-windows",
  version: 1,
  academic: emptyAcademicData(),
  internships: emptyDatabase(),
  preferences: { ...DEFAULT_PREFS },
});
let state = { ready: false, busy: false, error: "", notice: "", data: empty() };
let rawAcademic = JSON.stringify(state.data.academic);
const listeners = new Set<() => void>();
const bindAcademic = () =>
  configureAcademicStorage({
    read: () => rawAcademic,
    write: (value) => {
      rawAcademic = value;
    },
  });
bindAcademic();
function publish(next: Partial<typeof state>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}
export function useWorkspace() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );
}
export function validateWorkspace(value: unknown): asserts value is Workspace {
  const data = value as Workspace;
  if (data?.format !== "academic-dashboard-windows" || data.version !== 1)
    throw new Error("Unsupported desktop backup format.");
  validateAcademicData(data.academic);
  parseDatabase(JSON.stringify(data.internships));
  if (
    !data.preferences ||
    Object.keys(DEFAULT_PREFS).some(
      (key) => typeof data.preferences[key as keyof Preferences] !== "boolean",
    )
  )
    throw new Error("Invalid dashboard preferences.");
  data.preferences.showCalendar = false;
}
export async function initialize() {
  if (state.busy) return;
  publish({ busy: true, error: "" });
  try {
    if (!files)
      throw new Error(
        "The native storage module is unavailable. Rebuild the Windows application.",
      );
    const text = await files.Read();
    const data: Workspace = text ? JSON.parse(text) : empty();
    validateWorkspace(data);
    rawAcademic = JSON.stringify(data.academic);
    bindAcademic();
    publish({ data, ready: true });
  } catch (error) {
    publish({
      error: `Could not open local data. Existing files are untouched. ${String(error)}`,
      ready: false,
    });
  } finally {
    publish({ busy: false });
  }
}
/** Stage a complete transaction in memory, persist atomically, then publish it. */
export async function transact(
  change: (draft: Workspace) => void | Promise<void>,
  notice = "Saved on this device.",
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
    await files.Write(JSON.stringify(draft));
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
export async function exportWorkspace() {
  try {
    const contents = state.ready
      ? JSON.stringify(state.data, null, 2)
      : await files.Read();
    if (await files.Export("AcademicDashboard-backup.json", contents))
      publish({ notice: "Backup exported." });
  } catch (error) {
    reportError(error);
  }
}
