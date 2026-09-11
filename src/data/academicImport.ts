import {ACADEMIC_TYPES, entityDefaults, hydrateEntity, isRecord, mutateAcademicData, optionId, readAcademicData, textDocument, validDate, validateAcademicData, validateDocument, validateEntity, type AcademicData, type AcademicType, type DocumentContentJson, type Entity} from "./academic";

export type AcademicImport = {kind: "fibery"; type: AcademicType; rows: Record<string, unknown>[]} | {kind: "backup"; data: AcademicData};
export type ImportPreview = {added: number; skipped: number; names: Array<{type: string; name: string}>; warnings: string[]};
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const shortKey = (value: string) => normalize(value.split("/").at(-1) ?? value);

/** RFC 4180-style comma-separated exports, including quoted multiline Markdown. */
export function parseCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; let closed = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {if (input[i + 1] === '"') {cell += '"'; i++;} else {quoted = false; closed = true;}}
      else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error(`CSV row ${rows.length + 1}: unexpected quotation mark.`);
      quoted = true;
    } else if (char === ",") {row.push(cell); cell = ""; closed = false;}
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
      row = []; cell = ""; closed = false;
    } else {
      if (closed && char.trim()) throw new Error(`CSV row ${rows.length + 1}: text after a closing quotation mark.`);
      if (!closed) cell += char;
    }
  }
  if (quoted) throw new Error("The CSV ends inside a quoted field.");
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV must contain a header and at least one record.");
  const headers = rows[0].map((value) => value.trim());
  if (headers.some((value) => !value) || new Set(headers.map(normalize)).size !== headers.length) throw new Error("CSV headers must be nonempty and unique.");
  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has ${values.length} columns; expected ${headers.length}. Quote fields containing commas.`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}
export function parseAcademicImport(text: string, filename: string, type: AcademicType): AcademicImport {
  if (text.length > 10 * 1024 * 1024) throw new Error("Import files must be smaller than 10 MB. Split larger exports by collection.");
  let parsed: unknown;
  if (filename.toLowerCase().endsWith(".csv")) parsed = parseCsv(text);
  else {
    try {parsed = JSON.parse(text.replace(/^\uFEFF/, ""));} catch {throw new Error("This file is not valid JSON. Choose a .csv file for CSV exports.");}
    if (isRecord(parsed) && parsed.format === "academic-dashboard") {validateAcademicData(parsed); return {kind: "backup", data: parsed};}
  }
  if (isRecord(parsed)) parsed = parsed.entities ?? parsed.data ?? parsed[type] ?? parsed[type.split("/")[1]];
  if (!Array.isArray(parsed) || !parsed.length || !parsed.every(isRecord)) throw new Error("Expected an array of records, {entities: [...]}, {data: [...]}, a collection-named array, or an academic dashboard backup.");
  return {kind: "fibery", type, rows: parsed};
}
function field(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) if (row[name] !== undefined) return row[name];
  for (const [key, value] of Object.entries(row)) if (names.some((name) => shortKey(key) === shortKey(name))) return value;
  return undefined;
}
function stringValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (isRecord(value)) return stringValue(value["enum/name"] ?? value["University/Name"] ?? value.name ?? value.Name);
  throw new Error("Expected text or a named relation.");
}
function importedDate(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  const text = stringValue(value);
  if (!validDate(text)) throw new Error(`${label} “${text}” is invalid. Use YYYY-MM-DD (ISO timestamps are also supported).`);
  return text.slice(0, 10);
}
function ensureOption(data: AcademicData, fieldName: string, value: unknown) {
  if (value == null || value === "") return null;
  const list = data.options[fieldName] ??= [];
  if (isRecord(value) && typeof value["fibery/id"] === "string") {
    const existing = list.find((item) => item.id === value["fibery/id"]);
    if (existing) return {"fibery/id": existing.id};
  }
  let name = stringValue(value);
  if (!name) throw new Error(`${fieldName} needs a name; an ID-only enum cannot be resolved without its options.`);
  if (fieldName === "workflow/state") {
    if (["done", "complete", "completed"].includes(normalize(name))) name = "Done";
    if (["todo", "notstarted", "open"].includes(normalize(name))) name = "Not Started";
    if (["inprogress", "doing", "started"].includes(normalize(name))) name = "In Progress";
  }
  const option = list.find((item) => normalize(item.name) === normalize(name));
  const id = option?.id ?? optionId(fieldName, name);
  if (!option) list.push({id, name, ...(isRecord(value) && typeof value["enum/color"] === "string" ? {color: value["enum/color"]} : {})});
  return {"fibery/id": id};
}
function courseReference(value: unknown, data: AcademicData, warnings: string[]) {
  if (value == null || value === "") return null;
  const id = isRecord(value) ? stringValue(value["fibery/id"] ?? value.id) : typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : "";
  const name = stringValue(value);
  if (!id && !name) throw new Error("A course relation needs an ID or name.");
  const found = data.collections["University/Courses"].find((course) => course["fibery/id"] === id || course["fibery/id"] === name || (name && normalize(course["University/Name"]) === normalize(name)) || (name && course["fibery/public-id"] === name));
  if (found) return {"fibery/id": found["fibery/id"], "University/Name": found["University/Name"]};
  warnings.push(`Course “${name || id}” is unresolved. Import the Courses export to connect this preserved reference.`);
  return {"fibery/id": id || `import-course:${normalize(name)}`, "University/Name": name || `Unresolved course (${id})`};
}
function fingerprint(entity: Entity, data: AcademicData) {
  const hydrated = hydrateEntity(entity, data);
  const course = hydrated["University/Course"];
  return JSON.stringify([normalize(entity["University/Name"]), entity["University/Due Date"] ?? entity["University/Original Due Date"] ?? "", entity["University/Completion Date"] ?? "", isRecord(course) ? normalize(stringValue(course["University/Name"] || course["fibery/id"])) : "", isRecord(hydrated["University/Academic Year"]) ? stringValue(hydrated["University/Academic Year"]) : ""]);
}
function normalizeRow(row: Record<string, unknown>, type: AcademicType, data: AcademicData, warnings: string[]): Entity {
  const name = stringValue(field(row, "University/Name", "Name", "Title"));
  if (!name) throw new Error("A Name or Title column is required.");
  const id = stringValue(row["fibery/id"] ?? row.id ?? row.ID ?? row.Id) || crypto.randomUUID();
  const defaults = entityDefaults(type, id, data);
  // Preserve unknown export fields for future mappings and the native migration.
  const entity = {...row, ...defaults, "fibery/id": id, "University/Name": name, "fibery/public-id": stringValue(row["fibery/public-id"] ?? row["Public Id"] ?? row["Public ID"]) || id,
    "fibery/creation-date": stringValue(row["fibery/creation-date"] ?? row["Creation Date"]) || new Date().toISOString(), "fibery/modification-date": new Date().toISOString()} as Entity;
  if (type === "University/Assignments" || type === "University/To-Dos") {
    entity["University/Due Date"] = importedDate(field(row, "University/Due Date", "Due", "Deadline"), "Due date");
    entity["workflow/state"] = ensureOption(data, "workflow/state", field(row, "workflow/state", "Status")) ?? defaults["workflow/state"];
  }
  if (type === "University/Assignments" || type === "University/Completed Work") {
    entity["University/Course"] = courseReference(field(row, "University/Course", "Courses", "Course ID"), data, warnings);
    entity["University/Priority"] = ensureOption(data, "University/Priority", field(row, "University/Priority"));
  }
  if (type === "University/To-Dos" || type === "University/Completed Work") entity["University/Category"] = ensureOption(data, "University/Category", field(row, "University/Category"));
  if (type === "University/Courses") {
    const credits = field(row, "University/Credit Hours", "Credits");
    entity["University/Credit Hours"] = credits == null || credits === "" ? null : Number(credits);
    entity["University/Academic Year"] = ensureOption(data, "University/Academic Year", field(row, "University/Academic Year", "Semester", "Term"));
  }
  if (type === "University/Completed Work") {
    entity["University/Completion Date"] = importedDate(field(row, "University/Completion Date", "Completed Date"), "Completion date");
    entity["University/Original Due Date"] = importedDate(field(row, "University/Original Due Date", "Due Date", "Due"), "Original due date");
    entity["University/Type"] = ensureOption(data, "University/Type", field(row, "University/Type", "Kind"));
  }
  if (type === "University/Dashboard Notes") entity["University/Markdown"] = stringValue(field(row, "University/Markdown", "Content", "Text", "Body"));
  const description = field(row, "University/Description", "Description Markdown");
  const secret = (defaults["University/Description"] as Record<string, string>)["Collaboration~Documents/secret"];
  if (typeof description === "string") data.documents[secret] = {...textDocument(description), localMarkdown: description};
  else if (isRecord(description) && (isRecord(description.doc) || description.type === "doc")) {
    const document = description.type === "doc" ? {comments: [], doc: description} : description;
    validateDocument(document); data.documents[secret] = document as DocumentContentJson;
  } else if (description != null && description !== "") warnings.push(`“${name}” includes a document reference without content. Its original reference is retained; export Markdown or document JSON to import the text.`);
  if (description != null) entity["local/original-description"] = description;
  validateEntity(entity);
  return entity;
}
function mergeInto(data: AcademicData, source: AcademicImport): ImportPreview {
  const preview: ImportPreview = {added: 0, skipped: 0, names: [], warnings: []};
  const rowsByType: Array<[AcademicType, Record<string, unknown>[]]> = source.kind === "backup" ? ACADEMIC_TYPES.map((type) => [type, source.data.collections[type]]) : [[source.type, source.rows]];
  // Work on a disposable copy during preview; committing repeats against current storage.
  const errors: string[] = [];
  for (const [type, rows] of rowsByType) {
    const knownIds = new Set(data.collections[type].map((row) => row["fibery/id"]));
    const knownPrints = new Set(data.collections[type].map((row) => fingerprint(row, data)));
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const incomingId = stringValue(row["fibery/id"] ?? row.id ?? row.ID ?? row.Id);
      if (incomingId && knownIds.has(incomingId)) {preview.skipped++; continue;}
      try {
        const beforeDocuments = new Set(Object.keys(data.documents));
        const entity = source.kind === "backup" ? structuredClone(row) as Entity : normalizeRow(row, type, data, preview.warnings);
        const print = fingerprint(entity, source.kind === "backup" ? source.data : data);
        if (knownPrints.has(print)) {
          preview.skipped++;
          for (const secret of Object.keys(data.documents)) if (!beforeDocuments.has(secret)) delete data.documents[secret];
          continue;
        }
        if (source.kind === "backup") {
          const courseRef = entity["University/Course"];
          if (isRecord(courseRef)) {
            const sourceCourse = source.data.collections["University/Courses"].find(course => course["fibery/id"] === courseRef["fibery/id"]);
            if (sourceCourse) {
              const localCourse = data.collections["University/Courses"].find(course => course["fibery/id"] === sourceCourse["fibery/id"] || fingerprint(course, data) === fingerprint(sourceCourse, source.data));
              entity["University/Course"] = {"fibery/id": localCourse?.["fibery/id"] ?? sourceCourse["fibery/id"], "University/Name": sourceCourse["University/Name"]};
            }
          }
          const ref = entity["University/Description"];
          if (isRecord(ref) && typeof ref["Collaboration~Documents/secret"] === "string") {
            const oldSecret = ref["Collaboration~Documents/secret"];
            const newSecret = `local-document:${crypto.randomUUID()}`;
            data.documents[newSecret] = structuredClone(source.data.documents[oldSecret]);
            entity["University/Description"] = {"Collaboration~Documents/secret": newSecret};
          } else Object.assign(entity, entityDefaults(type, entity["fibery/id"], data), row);
          for (const [fieldName, options] of Object.entries(source.data.options)) {
            const ref = entity[fieldName];
            if (!isRecord(ref)) continue;
            const option = options.find((candidate) => candidate.id === ref["fibery/id"]);
            if (option) entity[fieldName] = ensureOption(data, fieldName, {"enum/name": option.name, "enum/color": option.color});
          }
        }
        validateEntity(entity); data.collections[type].push(entity); knownIds.add(entity["fibery/id"]); knownPrints.add(print);
        preview.added++; preview.names.push({type: type.split("/")[1], name: entity["University/Name"]});
      } catch (error) {errors.push(`${type.split("/")[1]} row ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);}
    }
  }
  if (errors.length) throw new Error(`${errors.length} invalid row${errors.length === 1 ? "" : "s"}. Nothing was imported.\n${errors.slice(0, 8).join("\n")}${errors.length > 8 ? "\n… Fix these rows and preview again." : ""}`);
  // Resolve name-based course references as soon as their course export arrives.
  for (const rows of Object.values(data.collections)) for (const row of rows) {
    if (row["University/Course"]) row["University/Course"] = hydrateEntity(row, data)["University/Course"];
  }
  preview.warnings = [...new Set(preview.warnings)];
  validateAcademicData(data);
  return preview;
}
export function previewAcademicImport(source: AcademicImport): ImportPreview {return mergeInto(readAcademicData(), source);}
export function commitAcademicImport(source: AcademicImport): ImportPreview {return mutateAcademicData((data) => mergeInto(data, source));}
