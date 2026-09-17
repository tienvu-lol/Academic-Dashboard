/** Local academic repository. UI code uses lib/fibery as a compatibility adapter. */
export const ACADEMIC_STORAGE_KEY = "academic-dashboard.academic.v1";
export const ACADEMIC_TYPES = ["University/Courses", "University/Assignments", "University/To-Dos", "University/Completed Work", "University/Dashboard Notes"] as const;
export type AcademicType = typeof ACADEMIC_TYPES[number];
export type Entity = Record<string, unknown> & {"fibery/id": string; "University/Name": string};
export type DocumentNodeJson = {type: string; attrs?: Record<string, unknown>; content?: DocumentNodeJson[]; marks?: Array<{type: string; attrs?: Record<string, unknown>}>; text?: string};
export type DocumentContentJson = {comments: unknown[]; doc: {type: "doc"; content: DocumentNodeJson[]}; localMarkdown?: string};
export type LocalOption = {id: string; name: string; color?: string};
export type AcademicData = {
  format: "academic-dashboard";
  version: 1;
  updatedAt: string;
  collections: Record<AcademicType, Entity[]>;
  documents: Record<string, DocumentContentJson>;
  options: Record<string, LocalOption[]>;
};

export interface AcademicStorageAdapter {read(): string | null; write(value: string): void}
let adapter: AcademicStorageAdapter = {
  read: () => {throw new Error("Native academic storage has not been configured.");},
  write: () => {throw new Error("Native academic storage has not been configured.");},
};
let cachedRaw: string | null | undefined;
let cachedData: AcademicData | undefined;
export function configureAcademicStorage(next: AcademicStorageAdapter) {adapter = next; cachedRaw = undefined; cachedData = undefined;}
export function isRecord(value: unknown): value is Record<string, unknown> {return !!value && typeof value === "object" && !Array.isArray(value);}
export function academicType(type: string): AcademicType {
  if (!(ACADEMIC_TYPES as readonly string[]).includes(type)) throw new Error(`Unsupported academic collection: ${type}`);
  return type as AcademicType;
}
export function optionId(field: string, name: string) {return `local-option:${field}:${name.trim().toLowerCase()}`;}
const optionColors = ["#a9c98b", "#e6c36b", "#e7909b", "#afa0de", "#84bde7"];
function options(field: string, names: string[]) {return names.map((name, i) => ({id: optionId(field, name), name, color: optionColors[i % optionColors.length]}));}
export function emptyAcademicData(): AcademicData {
  return {
    format: "academic-dashboard", version: 1, updatedAt: new Date().toISOString(),
    collections: Object.fromEntries(ACADEMIC_TYPES.map((type) => [type, [] as Entity[]])) as AcademicData["collections"],
    documents: {},
    options: {
      "workflow/state": options("workflow/state", ["Not Started", "In Progress", "Done"]),
      "University/Priority": options("University/Priority", ["Low", "Medium", "High", "Urgent"]),
      "University/Category": options("University/Category", ["Personal", "Academic", "Event / Social", "Career"]),
      "University/Academic Year": options("University/Academic Year", ["Fall 2026", "Spring 2027", "Summer 2027", "Fall 2027", "Spring 2028"]),
      "University/Type": options("University/Type", ["Assignment", "To-Do"]),
    },
  };
}
export function validDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!match) return false;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value.slice(0, 10);
}
function validateNode(value: unknown, depth = 0): boolean {
  return depth < 100 && isRecord(value) && typeof value.type === "string" &&
    (value.text === undefined || typeof value.text === "string") &&
    (value.attrs === undefined || isRecord(value.attrs)) &&
    (value.marks === undefined || (Array.isArray(value.marks) && value.marks.every((mark) => isRecord(mark) && typeof mark.type === "string" && (mark.attrs === undefined || isRecord(mark.attrs))))) &&
    (value.content === undefined || (Array.isArray(value.content) && value.content.every((node) => validateNode(node, depth + 1))));
}
export function validateDocument(value: unknown): asserts value is DocumentContentJson {
  if (!isRecord(value) || !Array.isArray(value.comments) || !isRecord(value.doc) || value.doc.type !== "doc" || !Array.isArray(value.doc.content) || !value.doc.content.every((node) => validateNode(node))) throw new Error("Invalid rich-text document in academic data.");
  if (value.localMarkdown !== undefined && typeof value.localMarkdown !== "string") throw new Error("Local description content must be text.");
  if (value.localMarkdown !== undefined && typeof value.localMarkdown !== "string") throw new Error("Invalid Markdown in academic description.");
}
export function validateEntity(value: unknown): asserts value is Entity {
  if (!isRecord(value) || typeof value["fibery/id"] !== "string" || !value["fibery/id"] || typeof value["University/Name"] !== "string" || !value["University/Name"].trim()) throw new Error("Every academic record needs an ID and a name.");
  for (const field of ["University/Due Date", "University/Original Due Date", "University/Completion Date"]) {
    if (value[field] != null && (typeof value[field] !== "string" || !validDate(value[field]))) throw new Error(`Invalid ${field} on “${value["University/Name"]}”. Use YYYY-MM-DD.`);
  }
  if (value["University/Credit Hours"] != null && (typeof value["University/Credit Hours"] !== "number" || !Number.isFinite(value["University/Credit Hours"]) || value["University/Credit Hours"] < 0)) throw new Error("Credit hours must be a nonnegative number.");
  if (value["University/Markdown"] != null && typeof value["University/Markdown"] !== "string") throw new Error("Note content must be text.");
  for (const field of ["University/Course", "University/Priority", "University/Category", "University/Academic Year", "University/Type", "workflow/state"]) {
    const ref = value[field];
    if (ref != null && (!isRecord(ref) || typeof ref["fibery/id"] !== "string" || !ref["fibery/id"])) throw new Error(`Invalid relation ${field} on “${value["University/Name"]}”.`);
  }
}
export function validateAcademicData(value: unknown): asserts value is AcademicData {
  if (!isRecord(value) || value.format !== "academic-dashboard" || value.version !== 1 || !isRecord(value.collections) || !isRecord(value.documents) || !isRecord(value.options) || typeof value.updatedAt !== "string") throw new Error("This academic backup has an unsupported format or version.");
  for (const key of Object.keys(value.collections)) academicType(key);
  for (const type of ACADEMIC_TYPES) {
    const rows = value.collections[type];
    if (!Array.isArray(rows)) throw new Error(`Missing collection ${type}.`);
    const ids = new Set<string>();
    for (const row of rows) {validateEntity(row); if (ids.has(row["fibery/id"])) throw new Error(`Duplicate record ID in ${type}.`); ids.add(row["fibery/id"]);}
  }
  for (const doc of Object.values(value.documents)) validateDocument(doc);
  for (const list of Object.values(value.options)) if (!Array.isArray(list) || !list.every((option) => isRecord(option) && typeof option.id === "string" && typeof option.name === "string" && (option.color === undefined || typeof option.color === "string"))) throw new Error("Invalid select options in academic backup.");
  for (const rows of Object.values(value.collections)) for (const row of rows as Entity[]) {
    const ref = row["University/Description"];
    if (ref != null && (!isRecord(ref) || typeof ref["Collaboration~Documents/secret"] !== "string" || !value.documents[ref["Collaboration~Documents/secret"]])) throw new Error("An academic description is missing from this backup.");
  }
}
export function readAcademicData(): AcademicData {
  let raw: string | null;
  try {raw = adapter.read();} catch {throw new Error("Local academic storage is unavailable.");}
  if (raw === cachedRaw && cachedData) return structuredClone(cachedData);
  if (raw === null) return emptyAcademicData();
  try {
    const data: unknown = JSON.parse(raw); validateAcademicData(data); cachedRaw = raw; cachedData = data;
    return structuredClone(data);
  } catch (error) {
    throw new Error(`Saved academic data could not be read. It has been left untouched; download the raw copy from Data & imports before repairing storage. ${error instanceof Error ? error.message : "Invalid JSON."}`);
  }
}
export function rawAcademicData() {return adapter.read();}
export function mutateAcademicData<T>(change: (data: AcademicData) => T): T {
  const data = readAcademicData();
  const result = change(data);
  data.updatedAt = new Date().toISOString();
  validateAcademicData(data);
  const raw = JSON.stringify(data);
  try {adapter.write(raw);} catch {throw new Error("Academic data could not be saved. Your previous saved data is unchanged; export a backup before retrying.");}
  cachedRaw = raw; cachedData = data;
  return result;
}
export function emptyDocument(): DocumentContentJson {return {comments: [], doc: {type: "doc", content: [{type: "paragraph"}]}};}
export function textDocument(text: string): DocumentContentJson {return {comments: [], doc: {type: "doc", content: text.split(/\r?\n/).map((line) => ({type: "paragraph", ...(line ? {content: [{type: "text", text: line}]} : {})}))}};}
export function entityDefaults(type: AcademicType, id: string, data: AcademicData): Record<string, unknown> {
  const defaults: Record<string, unknown> = {"fibery/public-id": id, "University/Due Date": null, "University/Days Left": null, "University/Course": null, "University/Priority": null, "University/Category": null, "University/Academic Year": null, "University/Type": null, "University/Credit Hours": null, "University/Completion Date": null, "University/Original Due Date": null, "University/Markdown": null};
  if (type === "University/Assignments" || type === "University/To-Dos") defaults["workflow/state"] = {"fibery/id": optionId("workflow/state", "Not Started")};
  const secret = `local-document:${type}:${id}`;
  data.documents[secret] ??= emptyDocument();
  defaults["University/Description"] = {"Collaboration~Documents/secret": secret};
  return defaults;
}
export function hydrateEntity(entity: Entity, data: AcademicData): Entity {
  const result = structuredClone(entity);
  for (const [field, list] of Object.entries(data.options)) {
    const ref = result[field];
    if (!isRecord(ref)) continue;
    const option = list.find((item) => item.id === ref["fibery/id"]);
    if (option) result[field] = {...ref, "enum/name": option.name, "enum/color": option.color ?? null};
  }
  const course = result["University/Course"];
  if (isRecord(course)) {
    const found = data.collections["University/Courses"].find((item) => item["fibery/id"] === course["fibery/id"] || (typeof course["University/Name"] === "string" && item["University/Name"].toLowerCase() === course["University/Name"].toLowerCase()));
    if (found) result["University/Course"] = {"fibery/id": found["fibery/id"], "University/Name": found["University/Name"]};
  }
  return result;
}
