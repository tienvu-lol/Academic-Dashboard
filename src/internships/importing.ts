import {addDays, createInternship, isDate, isInternship, mergeInternships, parseDatabase, safeUrl, todayLocal, type Availability, type Internship} from "./model";

export const SIMPLIFY_SOURCE = "https://github.com/SimplifyJobs/Summer2027-Internships";
export interface ImportOptions {sourceName: string; snapshotDate: string; availability: Availability}
export interface ImportPreview {items: Internship[]; skipped: number; duplicateCount: number; warnings: string[]}
type SourceRow = Record<string, unknown>;
const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
function decodeText(value: string): string {
  const entities: Record<string, string> = {amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘"};
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (original, name: string) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original;
    }
    return entities[name] ?? original;
  });
}
export function plainText(value: unknown): string {
  if (Array.isArray(value)) return value.map(plainText).join("; ");
  if (value === null || value === undefined) return "";
  return decodeText(String(value).replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/gi, "").replace(/<br\s*\/?\s*>/gi, "; ")
    .replace(/<[^>]*>/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*/g, ""))
    .replace(/\s+/g, " ").trim();
}
function firstLink(value: unknown): string {
  const input = String(value ?? "");
  const html = input.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
  const markdown = input.match(/\]\((https?:\/\/[^\s)]+)(?:\s+[^)]*)?\)/i)?.[1];
  return safeUrl(decodeText(html || markdown || input.trim()));
}
function read(row: SourceRow, ...aliases: string[]): unknown {
  const entry = Object.entries(row).find(([key]) => aliases.includes(normalizeKey(key)));
  return entry?.[1];
}
function dateValue(value: unknown, snapshotDate: string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value < 100000000000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  const text = plainText(value);
  if (isDate(text.slice(0, 10))) return text.slice(0, 10);
  if (/^\d{10,13}$/.test(text)) return dateValue(Number(text), snapshotDate);
  if (/^\d{1,4}\s*d(?:ays?)?$/i.test(text)) return addDays(snapshotDate, -parseInt(text, 10));
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const result = `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
    return isDate(result) ? result : "";
  }
  // Month/day alone is ambiguous across recruitment years; leave it unknown.
  return "";
}
/** RFC 4180-style CSV including quoted commas, escaped quotes and multiline notes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || !cell.trim()) quoted = !quoted;
      else cell += char;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some(value => value.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quotation mark.");
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}
function tableRows(text: string): SourceRow[] {
  const rows: SourceRow[] = [];
  if (/<table\b/i.test(text)) {
    for (const table of text.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
      let headers: string[] = [];
      for (const match of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => cell[1]);
        if (/<th\b/i.test(match[1])) { headers = cells.map(plainText); continue; }
        if (headers.length && cells.length) rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
      }
    }
    return rows;
  }
  let headers: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, "|"));
    if (cells.every(cell => /^:?-+:?$/.test(cell))) continue;
    if (cells.some(cell => normalizeKey(plainText(cell)) === "company") && cells.some(cell => ["role", "title", "position"].includes(normalizeKey(plainText(cell))))) {
      headers = cells.map(plainText); continue;
    }
    if (headers.length) rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  }
  return rows;
}
export function parseInternshipImport(text: string, options: ImportOptions): ImportPreview {
  if (!isDate(options.snapshotDate)) throw new Error("Choose the date this source file was downloaded.");
  if (text.length > 5_000_000) throw new Error("Choose a file smaller than 5 MB.");
  const input = text.replace(/^\uFEFF/, "").trim();
  if (!input) throw new Error("Choose a file or paste its contents first.");
  let rows: unknown[];
  if (input.startsWith("{") || input.startsWith("[")) {
    let parsed: unknown;
    try { parsed = JSON.parse(input); } catch { throw new Error("JSON could not be read. Check for missing commas or brackets."); }
    if (Array.isArray(parsed)) rows = parsed;
    else if (parsed && typeof parsed === "object") {
      const object = parsed as SourceRow;
      // A damaged backup must not be treated as fresh opportunities and lose history.
      if ("version" in object && "internships" in object) {
        rows = parseDatabase(input).internships;
      } else {
      const array = object.internships ?? object.listings ?? object.items ?? object.data ?? object.entities;
      if (!Array.isArray(array)) throw new Error("JSON must contain an array, or an internships, listings, items, data, or entities array.");
      rows = array;
      }
    } else throw new Error("JSON must contain internship records.");
  } else if (/<table\b/i.test(input) || /^\s*\|/m.test(input)) rows = tableRows(input);
  else {
    const [headers, ...data] = parseCsv(input);
    if (!headers?.some(header => ["company", "companyname", "employer"].includes(normalizeKey(header)))) throw new Error("CSV needs Company and Role (or Title) columns. README.md and JSON are also supported.");
    if (headers.some(header => !header.trim()) || new Set(headers.map(normalizeKey)).size !== headers.length) throw new Error("CSV headers must be nonempty and unique.");
    rows = data.map((cells, row) => {
      if (cells.length !== headers.length) throw new Error(`CSV row ${row + 2} has ${cells.length} columns; expected ${headers.length}. Quote fields containing commas.`);
      return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
    });
  }
  const items: Internship[] = [];
  const warnings: string[] = [];
  let skipped = 0, inheritedCompany = "", inferredDates = 0, unknownDates = 0;
  for (const [index, value] of rows.entries()) {
    if (isInternship(value)) { items.push({...value, tags: [...value.tags]}); continue; }
    if (!value || typeof value !== "object" || Array.isArray(value)) { skipped++; continue; }
    const row = value as SourceRow;
    let company = plainText(read(row, "company", "companyname", "employer")).replace(/^[🔥\s]+/u, "");
    if (company === "↳" || company === "↪" || company === "\"\"") company = inheritedCompany;
    else if (company) inheritedCompany = company;
    const role = plainText(read(row, "role", "title", "position", "jobtitle", "name"));
    if (!company || !role) { skipped++; if (warnings.length < 8) warnings.push(`Row ${index + 1}: missing company or role.`); continue; }
    const dateSource = read(row, "listeddate", "dateposted", "posteddate", "date", "age", "dateadded", "createdat");
    const listedDate = dateValue(dateSource, options.snapshotDate);
    if (/^\d+\s*d(?:ays?)?$/i.test(plainText(dateSource))) inferredDates++;
    if (!listedDate) unknownDates++;
    const deadlineRaw = read(row, "deadline", "duedate", "applicationdeadline", "closingdate");
    const deadline = dateValue(deadlineRaw, options.snapshotDate);
    if (deadlineRaw && !deadline && warnings.length < 8) warnings.push(`Row ${index + 1}: deadline could not be read; left blank.`);
    const urlRaw = read(row, "url", "application", "applicationurl", "link", "apply", "applylink", "applicationlink");
    const url = firstLink(urlRaw);
    if (urlRaw && !url && !String(urlRaw).includes("🔒") && warnings.length < 8) warnings.push(`Row ${index + 1}: no valid application link; left blank.`);
    const sourceAvailability = plainText(read(row, "availability", "status", "active", "isactive")) || (String(urlRaw ?? "").includes("🔒") ? "closed" : "");
    const tagsRaw = read(row, "tags", "category", "categories");
    items.push({
      ...createInternship(todayLocal()), company, role, listedDate, deadline, url, availability: options.availability,
      location: plainText(read(row, "location", "locations", "city")), notes: plainText(read(row, "notes", "description")),
      tags: (Array.isArray(tagsRaw) ? tagsRaw.map(plainText) : plainText(tagsRaw).split(/[,;]/)).map(tag => tag.trim()).filter(Boolean),
      source: "import", sourceName: options.sourceName.trim() || "Manual import", sourceId: plainText(read(row, "id", "sourceid", "uuid")), sourceAvailability,
    });
  }
  if (inferredDates) warnings.push(`${inferredDates} listed dates calculated from the source Age and snapshot date. Check the snapshot date before importing.`);
  if (unknownDates) warnings.push(`${unknownDates} unknown listed dates will use the date imported in the chart; you can edit them later.`);
  if (!items.length) throw new Error("No internship rows found. Use the raw README.md, a JSON array, or a CSV with Company and Role columns.");
  const unique = mergeInternships([], items);
  return {items: unique.items, skipped, duplicateCount: unique.duplicates, warnings};
}
