import {emptyDatabase, parseDatabase, type InternshipDatabase} from "./model";

/** Implement this port with a device store when the native app is introduced. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const INTERNSHIP_STORAGE_KEY = "academic-dashboard.internships.v1";
export function internshipRepository(storage: KeyValueStorage) {
  return {
    load(): InternshipDatabase {
      const raw = storage.getItem(INTERNSHIP_STORAGE_KEY);
      return raw ? parseDatabase(raw) : emptyDatabase();
    },
    save(database: InternshipDatabase): void {
      const serialized = JSON.stringify(database);
      parseDatabase(serialized);
      storage.setItem(INTERNSHIP_STORAGE_KEY, serialized);
    },
  };
}
