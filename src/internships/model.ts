/** Platform-independent internship records. Dates are local calendar dates (YYYY-MM-DD). */
export type Availability = "open" | "closed";
export type Outcome = "pending" | "ghosted" | "rejected" | "accepted";
export interface Internship {
  id: string;
  company: string;
  role: string;
  location: string;
  url: string;
  availability: Availability;
  listedDate: string;
  deadline: string;
  appliedDate: string;
  outcome: Outcome;
  outcomeDate: string;
  notes: string;
  tags: string[];
  source: "custom" | "import";
  sourceName: string;
  sourceId: string;
  sourceAvailability: string;
  createdAt: string;
  updatedAt: string;
}
export interface SemesterSettings {
  name: string;
  start: string;
  end: string;
  goal: number;
  compact: boolean;
}
export interface InternshipDatabase {
  version: 1;
  internships: Internship[];
  settings: SemesterSettings;
}
export const SEMESTERS: SemesterSettings[] = [
  {name: "VT · Fall 2026", start: "2026-08-24", end: "2026-12-16", goal: 50, compact: false},
  {name: "VT · Spring 2027", start: "2027-01-19", end: "2027-05-12", goal: 50, compact: false},
];
export function todayLocal(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch { return ""; }
}
export function canonicalUrl(value: string): string {
  const valid = safeUrl(value);
  if (!valid) return "";
  const url = new URL(valid);
  url.hash = "";
  for (const name of [...url.searchParams.keys()]) {
    if (name.startsWith("utm_") || ["ref", "source", "gh_src"].includes(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  return url.href.replace(/\/$/, "");
}
export function createInternship(date = todayLocal()): Internship {
  return {
    id: crypto.randomUUID(), company: "", role: "", location: "", url: "", availability: "open",
    listedDate: date, deadline: "", appliedDate: "", outcome: "pending", outcomeDate: "", notes: "", tags: [],
    source: "custom", sourceName: "Added manually", sourceId: "", sourceAvailability: "", createdAt: date, updatedAt: date,
  };
}
export function validateInternship(item: Internship, today = todayLocal()): string | null {
  if (!item.company.trim() || !item.role.trim()) return "Company and role are required.";
  if (item.url && !safeUrl(item.url)) return "Use an http:// or https:// application link.";
  for (const [field, value] of [["Listed date", item.listedDate], ["Deadline", item.deadline], ["Applied date", item.appliedDate], ["Outcome date", item.outcomeDate]]) {
    if (value && !isDate(value)) return `${field} must be a valid date.`;
  }
  if (item.appliedDate > today || item.outcomeDate > today) return "Application and outcome dates cannot be in the future.";
  if (item.listedDate && item.appliedDate && item.appliedDate < item.listedDate) return "Applied date cannot be before the listed date. Correct or clear the listed date if it is unknown.";
  if (item.outcome !== "pending" && (!item.appliedDate || !item.outcomeDate)) return "Record the application date and outcome date for a resolved application.";
  if (item.outcomeDate && item.appliedDate && item.outcomeDate < item.appliedDate) return "Outcome date cannot be before the application date.";
  return null;
}
export function validateSettings(settings: SemesterSettings): string | null {
  if (!settings.name.trim()) return "Give this semester a name.";
  if (!isDate(settings.start) || !isDate(settings.end) || settings.start > settings.end) return "Choose a valid start and end date.";
  if (Date.parse(settings.end) - Date.parse(settings.start) > 732 * 86400000) return "Choose a date range of no more than two years.";
  if (!Number.isInteger(settings.goal) || settings.goal < 1 || settings.goal > 100000) return "Application goal must be a whole number from 1 to 100,000.";
  return null;
}
export function needsReview(item: Internship, today = todayLocal()): boolean {
  return !!item.appliedDate && !!item.deadline && item.deadline < today && item.outcome === "pending";
}
export function identityKeys(item: Pick<Internship, "sourceId" | "sourceName" | "company" | "role" | "location" | "url">): string[] {
  const keys: string[] = [];
  if (item.sourceId) keys.push(`id:${item.sourceName}:${item.sourceId}`);
  const url = canonicalUrl(item.url);
  if (url) keys.push(`url:${url}`);
  // Distinct role URLs can represent separate openings with identical titles.
  if (!url) keys.push(`role:${[item.company, item.role, item.location].map(value => value.trim().toLowerCase()).join("|")}`);
  return keys;
}
/** Imports append only: existing notes, dates, availability and outcomes are never overwritten. */
export function mergeInternships(existing: Internship[], incoming: Internship[]): {items: Internship[]; added: number; duplicates: number} {
  const keys = new Set(existing.flatMap(identityKeys));
  const ids = new Set(existing.map(item => item.id));
  const additions: Internship[] = [];
  let duplicates = 0;
  for (const item of incoming) {
    const itemKeys = identityKeys(item);
    if (ids.has(item.id) || itemKeys.some(key => keys.has(key))) { duplicates++; continue; }
    itemKeys.forEach(key => keys.add(key));
    ids.add(item.id);
    additions.push(item);
  }
  return {items: [...existing, ...additions], added: additions.length, duplicates};
}
export interface SemesterPoint {
  date: string;
  opportunities: number | null;
  sent: number | null;
  accepted: number | null;
  rejected: number | null;
}
/** Sort once, then sweep calendar days; include pre-semester records as the opening balance. */
export function semesterSeries(items: Internship[], settings: SemesterSettings, today = todayLocal()): SemesterPoint[] {
  if (validateSettings(settings)) return [];
  const dates = {
    opportunities: items.map(item => item.listedDate || item.createdAt.slice(0, 10)).filter(isDate).sort(),
    sent: items.map(item => item.appliedDate).filter(isDate).sort(),
    accepted: items.filter(item => item.outcome === "accepted").map(item => item.outcomeDate).filter(isDate).sort(),
    rejected: items.filter(item => item.outcome === "rejected").map(item => item.outcomeDate).filter(isDate).sort(),
  };
  const counters = {opportunities: 0, sent: 0, accepted: 0, rejected: 0};
  const result: SemesterPoint[] = [];
  for (let date = settings.start; date <= settings.end; date = addDays(date, 1)) {
    const point: SemesterPoint = {date, opportunities: null, sent: null, accepted: null, rejected: null};
    if (date <= today) {
      for (const key of Object.keys(counters) as Array<keyof typeof counters>) {
        while (counters[key] < dates[key].length && dates[key][counters[key]] <= date) counters[key]++;
        point[key] = counters[key];
      }
    }
    result.push(point);
  }
  return result;
}
export function emptyDatabase(): InternshipDatabase {
  return {version: 1, internships: [], settings: {...SEMESTERS[0]}};
}
export function isInternship(value: unknown): value is Internship {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const strings = ["id", "company", "role", "location", "url", "listedDate", "deadline", "appliedDate", "outcomeDate", "notes", "sourceName", "sourceId", "sourceAvailability", "createdAt", "updatedAt"];
  return strings.every(key => typeof item[key] === "string") && !!item.id && !!item.company && !!item.role
    && ["open", "closed"].includes(String(item.availability)) && ["pending", "ghosted", "rejected", "accepted"].includes(String(item.outcome))
    && ["custom", "import"].includes(String(item.source)) && Array.isArray(item.tags) && item.tags.every(tag => typeof tag === "string")
    && [item.listedDate, item.deadline, item.appliedDate, item.outcomeDate].every(date => date === "" || isDate(date))
    && isDate(String(item.createdAt).slice(0, 10)) && isDate(String(item.updatedAt).slice(0, 10))
    && (!item.url || !!safeUrl(String(item.url)))
    && (item.outcome === "pending" ? !item.outcomeDate : (!!item.appliedDate && !!item.outcomeDate))
    && (!item.appliedDate || !item.listedDate || String(item.appliedDate) >= String(item.listedDate))
    && (!item.outcomeDate || String(item.outcomeDate) >= String(item.appliedDate));
}
export function parseDatabase(text: string): InternshipDatabase {
  const value = JSON.parse(text);
  if (!value || value.version !== 1 || !Array.isArray(value.internships) || !value.internships.every(isInternship)) throw new Error("This is not a supported internship backup.");
  const settings = value.settings;
  if (!settings || typeof settings.name !== "string" || typeof settings.compact !== "boolean" || validateSettings(settings)) throw new Error("The saved semester settings are invalid.");
  if (new Set(value.internships.map((item: Internship) => item.id)).size !== value.internships.length) throw new Error("The saved data contains duplicate record IDs.");
  return value as InternshipDatabase;
}
