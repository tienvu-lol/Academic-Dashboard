/** Compatibility facade for migrated Fibery components; every operation is local. */
import {academicType, entityDefaults, hydrateEntity, isRecord, mutateAcademicData, readAcademicData, validateDocument, validateEntity, type DocumentContentJson, type Entity} from "../data/academic";
export type {DocumentContentJson, DocumentNodeJson} from "../data/academic";

export type FieldPath = string | string[];
export type OrderBy = {field: FieldPath; direction?: "asc" | "desc"};
export type WhereExpr = unknown;
export type CollectionSubQuery = {"q/select": SelectItem[]; "q/limit": number | "q/no-limit"; "q/where"?: WhereExpr; "q/order-by"?: [string[], "q/asc" | "q/desc"][]; "q/offset"?: number};
export type SelectItem = string | {[field: string]: SelectItem[] | CollectionSubQuery};
export type QueryEntitiesArgs = {type: string; fields: SelectItem[]; where?: WhereExpr; orderBy?: OrderBy | OrderBy[]; limit?: number; offset?: number; params?: Record<string, unknown>};
function atPath(value: unknown, path: FieldPath): unknown {return (Array.isArray(path) ? path : [path]).reduce<unknown>((current, key) => isRecord(current) ? current[key] : undefined, value);}
function matches(entity: Entity, expression: unknown, params: Record<string, unknown>): boolean {
  if (expression === undefined) return true;
  if (!Array.isArray(expression)) throw new Error("Unsupported local query condition.");
  const [op, left, right] = expression;
  if (op === "q/and") return expression.slice(1).every((part) => matches(entity, part, params));
  if (op === "q/or") return expression.slice(1).some((part) => matches(entity, part, params));
  const actual = atPath(entity, left as FieldPath);
  const expected = typeof right === "string" && right.startsWith("$") ? params[right] : right;
  if (op === "=") return actual === expected;
  if (op === "!=") return actual !== expected;
  if (op === "q/in") return Array.isArray(expected) && expected.includes(actual);
  if (op === ">") return String(actual) > String(expected);
  if (op === "<") return String(actual) < String(expected);
  throw new Error(`Unsupported local query operator: ${String(op)}`);
}
export async function queryEntities<T = unknown>(input: QueryEntitiesArgs): Promise<T[]> {
  // Google Calendar imports are deliberately disabled during migration.
  if (input.type.startsWith("Google Calendar/")) return [];
  const data = readAcademicData();
  const rows = data.collections[academicType(input.type)].map((row) => hydrateEntity(row, data)).filter((row) => matches(row, input.where, input.params ?? {}));
  if (input.orderBy) {
    const orders = Array.isArray(input.orderBy) ? input.orderBy : [input.orderBy];
    rows.sort((a, b) => {
      for (const order of orders) {
        const left = atPath(a, order.field); const right = atPath(b, order.field);
        if (left == null && right != null) return 1;
        if (right == null && left != null) return -1;
        const diff = typeof left === "number" && typeof right === "number" ? left - right : String(left ?? "").localeCompare(String(right ?? ""));
        if (diff) return order.direction === "desc" ? -diff : diff;
      }
      return 0;
    });
  }
  return rows.slice(input.offset ?? 0, input.limit === undefined ? undefined : (input.offset ?? 0) + input.limit) as T[];
}
export async function getEntityById<T = unknown>(input: {type: string; id: string; fields: SelectItem[]}): Promise<T | null> {
  const rows = await queryEntities<T>({...input, where: ["=", ["fibery/id"], "$id"], params: {$id: input.id}, limit: 1});
  return rows[0] ?? null;
}
export async function getEntitiesByIds<T = unknown>(input: {type: string; ids: string[]; fields: SelectItem[]}): Promise<T[]> {
  return queryEntities<T>({...input, where: ["q/in", ["fibery/id"], "$ids"], params: {$ids: input.ids}});
}
export async function createEntity<T = unknown>({type: name, values}: {type: string; values: Record<string, unknown>}): Promise<T> {
  const type = academicType(name);
  return mutateAcademicData((data) => {
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    const entity = {...entityDefaults(type, id, data), ...values, "fibery/id": id, "fibery/creation-date": now, "fibery/modification-date": now};
    validateEntity(entity); data.collections[type].push(entity); return hydrateEntity(entity, data) as T;
  });
}
export async function updateEntity<T = unknown>({type: name, id, values}: {type: string; id: string; values: Record<string, unknown>}): Promise<T> {
  const type = academicType(name);
  return mutateAcademicData((data) => {
    const index = data.collections[type].findIndex((row) => row["fibery/id"] === id);
    if (index < 0) throw new Error("This record no longer exists. Refresh the dashboard.");
    const entity = {...data.collections[type][index], ...values, "fibery/id": id, "fibery/modification-date": new Date().toISOString()};
    validateEntity(entity); data.collections[type][index] = entity; return hydrateEntity(entity, data) as T;
  });
}
export async function deleteEntity({type: name, id}: {type: string; id: string}): Promise<void> {
  const type = academicType(name);
  mutateAcademicData((data) => {
    const entity = data.collections[type].find((row) => row["fibery/id"] === id);
    if (!entity) throw new Error("This record no longer exists.");
    data.collections[type] = data.collections[type].filter((row) => row["fibery/id"] !== id);
    if (type === "University/Courses") for (const rows of Object.values(data.collections)) for (const row of rows) {
      if (isRecord(row["University/Course"]) && row["University/Course"]["fibery/id"] === id) row["University/Course"] = null;
    }
    const ref = entity["University/Description"];
    if (isRecord(ref) && typeof ref["Collaboration~Documents/secret"] === "string") {
      const secret = ref["Collaboration~Documents/secret"];
      const shared = Object.values(data.collections).flat().some((row) => isRecord(row["University/Description"]) && row["University/Description"]["Collaboration~Documents/secret"] === secret);
      if (!shared) delete data.documents[secret];
    }
  });
}
export type SelectOption = {id: string; name: string};
export async function getWorkflowStates({type}: {type: string}): Promise<SelectOption[]> {academicType(type); return readAcademicData().options["workflow/state"] ?? [];}
export async function getSingleSelectOptions({type, field}: {type: string; field: string}): Promise<SelectOption[]> {academicType(type); return readAcademicData().options[field] ?? [];}
export const getMultiSelectOptions = getSingleSelectOptions;
export async function getDocument({secret}: {secret: string}): Promise<DocumentContentJson> {
  const doc = readAcademicData().documents[secret];
  if (!doc) throw new Error("This description is not in local storage. Import the document content from Fibery.");
  return doc;
}
export async function setDocument({secret, content}: {secret: string; content: DocumentContentJson}): Promise<void> {
  validateDocument(content);
  mutateAcademicData((data) => {if (!data.documents[secret]) throw new Error("This description no longer exists."); data.documents[secret] = structuredClone(content);});
}
export async function getSchema() {return {getTypeObjectByName: (type: string) => ({name: type, color: type === "University/Courses" ? "#9abde8" : "#aaa09a"})};}
