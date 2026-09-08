import {factory, type Schema} from "@fibery/schema";

export type DocumentNodeJson = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocumentNodeJson[];
  marks?: Array<{type: string; attrs?: Record<string, unknown>}>;
  text?: string;
};

export type DocumentContentJson = {
  comments: Array<unknown>;
  doc: {type: "doc"; content: DocumentNodeJson[];};
};

const PARALLEL_LIMIT = 3;

let activeRequests = 0;
const requestQueue: Array<() => void> = [];

const limit = <T>(task: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const run = () => {
      activeRequests += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeRequests -= 1;
          requestQueue.shift()?.();
        });
    };
    if (activeRequests < PARALLEL_LIMIT) run();
    else requestQueue.push(run);
  });

const appendQueryParameter = (url: string, key: string, value: string | null): string => {
  if (!value) return url;
  const [location, ...hash] = url.split("#");
  const prefix = location.includes("?") ? "&" : "?";
  return [`${location}${prefix}${key}=${value}`, ...hash].join("#");
};

const isPublic = new URLSearchParams(window.location.search).has("is-public");
const appendIsPublic = (url: string): string =>
  isPublic ? appendQueryParameter(url, "is-public", "1") : url;

const apiUrl = (url: string): string =>
  appendIsPublic(appendQueryParameter(url, "reason", "custom-app"));

// nosemgrep: nodejs_scan.javascript-ssrf-rule-node_ssrf
const limitedFetch: typeof fetch = (input, init) => limit(() => fetch(input, init));

// ─── /api/commands envelope ──────────────────────────────────────────────────

type FiberyCommand = {
  command: string;
  args?: unknown;
};

type Envelope<T> =
  | {success: true; result: T}
  | {success: false; result: {name: string; message: string; data?: unknown}};

function trim(string: string, maxLength: number) {
  if (string.length > maxLength) {
    const etc = "...";
    return string.slice(0, maxLength) + etc;
  }
  return string;
}

const getAnonymousCommandSummary = ({command, args}: FiberyCommand): string => {
  const a = (args ?? {}) as {
    query?: {"q/from"?: string};
    commands?: FiberyCommand[];
    type?: string;
    field?: string;
  };
  if (command === "fibery.entity/query") {
    return `${command}(${a.query?.["q/from"]})`;
  }
  if (command === "fibery.command/batch") {
    return `${command}(${a.commands?.length}:[${(a.commands ?? []).map(getAnonymousCommandSummary).join(",")}])`;
  }
  if (command === "fibery.entity/create" || command === "fibery.entity/update" || command === "fibery.entity/delete") {
    return `${command}(${a.type})`;
  }
  if (
    command === "fibery.entity/add-collection-items" ||
    command === "fibery.entity/remove-collection-items" ||
    command === "fibery.entity/set-collection-items" ||
    command === "fibery.entity/reset-collection-items"
  ) {
    return `${command}(${a.type},${a.field})`;
  }
  return command;
};

const commandsUrl = (body: FiberyCommand[]): string =>
  appendIsPublic(
    "/api/commands" +
      trim(`?reason=custom-app&_=${body.length}:[${body.map(getAnonymousCommandSummary).join(",")}]`, 1000),
  );

const command = async <T = unknown>({command, args}: FiberyCommand): Promise<T> => {
  const body = [{command, args: args ?? {}}];
  const res = await limitedFetch(commandsUrl(body), {
    method: "POST",
    credentials: "same-origin",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Fibery command "${command}" failed: ${res.status} ${await res.text()}`);
  }
  const envelopes = (await res.json()) as Envelope<T>[];
  const envelope = envelopes[0];
  if (!envelope) {
    throw new Error(`Fibery command "${command}" returned no envelope`);
  }
  if (!envelope.success) {
    throw new Error(
      `Fibery command "${command}" failed: ${envelope.result.name} — ${envelope.result.message}`,
    );
  }
  return envelope.result;
};

// ─── §1 Entity CRUD ──────────────────────────────────────────────────────────

/** Path expression used by `orderBy` (and inside `where` DSL). */
export type FieldPath = string | string[];

export type OrderBy = {field: FieldPath; direction?: "asc" | "desc"};

/**
 * Raw Fibery where expression, e.g.
 *   [">", ["Cricket/Height"], "$height"]
 *   ["q/and", ["=", ["Cricket/Retired"], false], [">", ["Cricket/Height"], "$h"]]
 * Bind `$name` placeholders via `params`.
 */
export type WhereExpr = unknown;

/**
 * Sub-query for projecting fields from a COLLECTION field — the "many" side of
 * a one-to-many, or any side of a many-to-many. `schema_detailed` marks these
 * as `# collection`. Using the bare-array map form on a collection fails with
 * `entity.error/query-select-collection-field-vector-shape-invalid` — use this
 * sub-query shape instead.
 *   {"Cricket/Players": {
 *      "q/select": ["fibery/id", "Cricket/Name"],
 *      "q/limit":  100,
 *   }}
 * `q/limit` is required. Prefer a numeric limit; `"q/no-limit"` is still
 * accepted today but is slated for deprecation by Fibery.
 */
export type CollectionSubQuery = {
  "q/select": SelectItem[];
  "q/where"?: WhereExpr;
  "q/order-by"?: [string[], "q/asc" | "q/desc"][];
  "q/limit": number | "q/no-limit";
  "q/offset"?: number;
};

/**
 * A single item inside `q/select`. Three forms:
 *   - Flat field name:                "Cricket/Name"
 *   - Single-relation projection:     {"Cricket/Current Team": ["fibery/id", "Cricket/Name"]}
 *                                     {"workflow/state":       ["fibery/id", "enum/name"]}
 *   - Collection sub-query:           {"Cricket/Players": {"q/select": ["fibery/id"],
 *                                                          "q/limit": 100}}
 * Use the map form for many-to-one / one-to-one / workflow / single-select;
 * use the sub-query form for any collection (one-to-many "many" side or m2m).
 */
export type SelectItem =
  | string
  | {[field: string]: SelectItem[] | CollectionSubQuery};

export type QueryEntitiesArgs = {
  type: string;
  fields: SelectItem[];
  where?: WhereExpr;
  orderBy?: OrderBy | OrderBy[];
  limit?: number;
  offset?: number;
  params?: Record<string, unknown>;
};

const toFieldPath = (f: FieldPath): string[] => (Array.isArray(f) ? f : [f]);

// Fibery requires q/limit on every query (entity.error/query-limit-expr-not-found).
// "q/no-limit" is Fibery's "return all matching rows" sentinel — fine for small
// datasets, but pass an explicit numeric `limit` (+ `offset`) for paginated UIs.
const DEFAULT_QUERY_LIMIT = "q/no-limit" as const;

export const queryEntities = <T = unknown>(input: QueryEntitiesArgs): Promise<T[]> => {
  const query: Record<string, unknown> = {
    "q/from": input.type,
    "q/select": input.fields,
    "q/limit": input.limit ?? DEFAULT_QUERY_LIMIT,
  };
  if (input.where !== undefined) query["q/where"] = input.where;
  if (input.orderBy) {
    const list = Array.isArray(input.orderBy) ? input.orderBy : [input.orderBy];
    query["q/order-by"] = list.map((o) => [
      toFieldPath(o.field),
      o.direction === "desc" ? "q/desc" : "q/asc",
    ]);
  }
  if (input.offset !== undefined) query["q/offset"] = input.offset;
  return command<T[]>({
    command: "fibery.entity/query",
    args: {query, ...(input.params ? {params: input.params} : {})},
  });
};

export type GetEntityByIdArgs = {type: string; id: string; fields: SelectItem[]};

export const getEntityById = async <T = unknown>(input: GetEntityByIdArgs): Promise<T | null> => {
  const rows = await queryEntities<T>({
    type: input.type,
    fields: input.fields,
    where: ["=", ["fibery/id"], "$id"],
    params: {$id: input.id},
    limit: 1,
  });
  return rows[0] ?? null;
};

export type GetEntitiesByIdsArgs = {type: string; ids: string[]; fields: SelectItem[]};

export const getEntitiesByIds = <T = unknown>(input: GetEntitiesByIdsArgs): Promise<T[]> =>
  queryEntities<T>({
    type: input.type,
    fields: input.fields,
    where: ["q/in", ["fibery/id"], "$ids"],
    params: {$ids: input.ids},
    limit: input.ids.length,
  });

export type CreateEntityArgs = {type: string; values: Record<string, unknown>};

export const createEntity = <T = unknown>(input: CreateEntityArgs): Promise<T> =>
  command<T>({
    command: "fibery.entity/create",
    args: {type: input.type, entity: input.values},
  });

export type UpdateEntityArgs = {type: string; id: string; values: Record<string, unknown>};

export const updateEntity = <T = unknown>(input: UpdateEntityArgs): Promise<T> =>
  command<T>({
    command: "fibery.entity/update",
    args: {type: input.type, entity: {"fibery/id": input.id, ...input.values}},
  });

export type DeleteEntityArgs = {type: string; id: string};

export const deleteEntity = (input: DeleteEntityArgs): Promise<void> =>
  command<void>({
    command: "fibery.entity/delete",
    args: {type: input.type, entity: {"fibery/id": input.id}},
  });

// ─── §2 Collection items (relations — UUIDs only) ────────────────────────────
//
// For multi-select fields (which Fibery models as collections of enum entities),
// use these same functions: pass the option's `fibery/id` from getMultiSelectOptions.

export type CollectionItemsArgs = {
  type: string;
  field: string;
  id: string;
  itemIds: string[];
};

export const addCollectionItems = (input: CollectionItemsArgs): Promise<void> =>
  command<void>({
    command: "fibery.entity/add-collection-items",
    args: {type: input.type, field: input.field, entity: {[input.id]: input.itemIds}},
  });

export const removeCollectionItems = (input: CollectionItemsArgs): Promise<void> =>
  command<void>({
    command: "fibery.entity/remove-collection-items",
    args: {type: input.type, field: input.field, entity: {[input.id]: input.itemIds}},
  });

// ─── §3 Option lookup for selects and workflow states ────────────────────────
//
// Workflow / single-select / multi-select fields all target an "enum subtype"
// — a hidden type whose entities are the option values. To render a dropdown,
// fetch its options via these helpers; to write, use the option's `id`:
//
//   const states = await getWorkflowStates({type: "Sample/Task"});
//   await updateEntity({
//     type: "Sample/Task", id, values: {"workflow/state": {"fibery/id": states[0].id}},
//   });
//
//   const tags = await getMultiSelectOptions({type: "Sample/Task", field: "Sample/Tags"});
//   await addCollectionItems({type: "Sample/Task", field: "Sample/Tags", id, itemIds: [tags[0].id]});

export type SelectOption = {id: string; name: string};

const queryEnumOptions = async (enumType: string): Promise<SelectOption[]> => {
  const rows = await queryEntities<{"fibery/id": string; "enum/name": string}>({
    type: enumType,
    fields: ["fibery/id", "enum/name"],
  });
  return rows.map((r) => ({id: r["fibery/id"], name: r["enum/name"]}));
};

export type GetWorkflowStatesArgs = {type: string};

export const getWorkflowStates = async ({type}: GetWorkflowStatesArgs): Promise<SelectOption[]> => {
  const enumType = await findFieldTargetType(type, "workflow/state");
  return queryEnumOptions(enumType);
};

export type GetSelectOptionsArgs = {type: string; field: string};

export const getSingleSelectOptions = async ({
  type,
  field,
}: GetSelectOptionsArgs): Promise<SelectOption[]> => {
  const enumType = await findFieldTargetType(type, field);
  return queryEnumOptions(enumType);
};

export const getMultiSelectOptions = async ({
  type,
  field,
}: GetSelectOptionsArgs): Promise<SelectOption[]> => {
  const enumType = await findFieldTargetType(type, field);
  return queryEnumOptions(enumType);
};

// ─── §4 Documents (rich-text) ────────────────────────────────────────────────
//
// Caller obtains the document `secret` by including
// `Collaboration~Documents/secret` in their queryEntities projection:
//
//   const rows = await queryEntities<{
//     "fibery/id": string;
//     "Cricket/Bio": {"Collaboration~Documents/secret": string};
//   }>({
//     type: "Cricket/Player",
//     fields: ["fibery/id", {"Cricket/Bio": ["Collaboration~Documents/secret"]}],
//     where: ["=", ["fibery/id"], "$id"],
//     params: {$id: id},
//     limit: 1,
//   });
//   const documentContent = await getDocument({secret: rows[0]["Cricket/Bio"]["Collaboration~Documents/secret"]});

export type GetDocumentArgs = {secret: string};

export const getDocument = async ({secret}: GetDocumentArgs): Promise<DocumentContentJson> => {
  const res = await limitedFetch(apiUrl(`/api/documents/${encodeURIComponent(secret)}?format=json`), {
    credentials: "same-origin",
  });
  if (!res.ok) {
    throw new Error(`Fibery getDocument failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as {secret: string; content: DocumentContentJson};
  return body.content;
};

export type SetDocumentArgs = {secret: string; content: DocumentContentJson};

export const setDocument = async ({secret, content}: SetDocumentArgs): Promise<void> => {
  const res = await limitedFetch(apiUrl(`/api/documents/${encodeURIComponent(secret)}?format=json`), {
    method: "PUT",
    credentials: "same-origin",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({content}),
  });
  if (!res.ok) {
    throw new Error(`Fibery setDocument failed: ${res.status} ${await res.text()}`);
  }
};

// ─── §5 Comments ─────────────────────────────────────────────────────────────
//
// Adds a Markdown comment to an entity. `parentId` threads under another
// comment; omit it for a top-level comment.

export type AddCommentArgs = {
  type: string;
  id: string;
  content: string;
  parentId?: string;
};

export const addComment = async ({
  type,
  id,
  content,
  parentId,
}: AddCommentArgs): Promise<{id: string}> => {
  const commentId = crypto.randomUUID();
  const commentSecret = crypto.randomUUID();
  const res = await limitedFetch(apiUrl("/api/documents/commands/create-comment?format=md"), {
    method: "POST",
    credentials: "same-origin",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      commentContent: content,
      commentId,
      commentParentId: parentId ?? null,
      commentSecret,
      holderId: id,
      holderType: type,
    }),
  });
  if (!res.ok) {
    throw new Error(`Fibery addComment failed: ${res.status} ${await res.text()}`);
  }
  return {id: commentId};
};

// ─── §6 File uploads ─────────────────────────────────────────────────────────
//
// Upload a file, then attach it to an entity's Files field via addCollectionItems:
//   const f = await uploadFile({file, name: "report.pdf"});
//   await addCollectionItems({type, field: "Sample/Files", id, itemIds: [f.id]});

export type UploadedFile = {
  id: string;
  secret: string;
  name: string;
  contentType: string;
  contentLength: number;
};

const toUploadedFile = (raw: Record<string, unknown>): UploadedFile => ({
  id: raw["fibery/id"] as string,
  secret: raw["fibery/secret"] as string,
  name: raw["fibery/name"] as string,
  contentType: raw["fibery/content-type"] as string,
  contentLength: raw["fibery/content-length"] as number,
});

export type UploadFileArgs = {file: Blob; name?: string; contentType?: string};

export const uploadFile = async ({
  file,
  name,
  contentType,
}: UploadFileArgs): Promise<UploadedFile> => {
  const filename = name ?? (file instanceof File ? file.name : "upload");
  const blob = contentType ? file.slice(0, file.size, contentType) : file;
  const form = new FormData();
  form.append("file", blob, filename);
  const res = await limitedFetch(apiUrl("/api/files"), {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Fibery uploadFile failed: ${res.status} ${await res.text()}`);
  }
  return toUploadedFile((await res.json()) as Record<string, unknown>);
};

export type UploadFileFromUrlArgs = {
  url: string;
  name?: string;
  headers?: Record<string, string>;
};

export const uploadFileFromUrl = async ({
  url,
  name,
  headers,
}: UploadFileFromUrlArgs): Promise<UploadedFile> => {
  const res = await limitedFetch(apiUrl("/api/files/from-url"), {
    method: "POST",
    credentials: "same-origin",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({url, ...(name ? {name} : {}), ...(headers ? {headers} : {})}),
  });
  if (!res.ok) {
    throw new Error(`Fibery uploadFileFromUrl failed: ${res.status} ${await res.text()}`);
  }
  return toUploadedFile((await res.json()) as Record<string, unknown>);
};

export const makeFileUrl = (secret: string): string =>
  apiUrl(`/api/files/${encodeURIComponent(secret)}`);

// ─── §7 Schema introspection ─────────────────────────────────────────────────
//
// The workspace schema as @fibery/schema objects. Key surface:
//   schema.getTypeObjectByName("Cricket/Player")  → TypeObject | null
//   schema.getTypeObjectById(typeId)              → TypeObject | null (entity links, mentions)
//   TypeObject:  title, pluralTitle, singularTitle, isEnum, isPrimitive,
//                titleField, idField, fieldObjects, nameParts,
//                getFieldObjectByName(name) / getFieldObjectById(id) → FieldObject | null
//   FieldObject: name, title, type, typeObject, isCollection, isReadOnly,
//                isRequired, isHidden, isFormula, cardinality, relatedFieldObject,
//                holderTypeObject, nameParts
//   nameParts is {namespace, name} — never split "Space/Name" strings by hand.
// IMPORTANT: never re-derive titles, plural forms, or cardinality by hand —
// use these getters; they encode Fibery's actual naming and relation rules.

let cachedSchema: {etag: string; schema: Schema} | null = null;

export const getSchema = async (): Promise<Schema> => {
  const res = await limitedFetch(apiUrl("/api/schema?with-description=false&with-soft-deleted=false"), {
    credentials: "same-origin",
    headers: cachedSchema ? {"if-none-match": cachedSchema.etag} : {},
  });
  if (res.status === 304 && cachedSchema) return cachedSchema.schema;
  if (!res.ok) {
    throw new Error(`Fibery schema request failed: ${res.status} ${await res.text()}`);
  }
  const schema = factory.makeSchema((await res.json()) as Record<string, unknown>);
  const etag = res.headers.get("etag");
  if (etag) cachedSchema = {etag, schema};
  return schema;
};

export type {Schema, TypeObject, FieldObject, Cardinality} from "@fibery/schema";

const findFieldTargetType = async (type: string, field: string): Promise<string> => {
  const schema = await getSchema();
  const typeObject = schema.getTypeObjectByName(type);
  if (!typeObject) throw new Error(`Fibery type "${type}" not found in schema`);
  const fieldObject = typeObject.getFieldObjectByName(field);
  if (!fieldObject) throw new Error(`Field "${field}" not found on Fibery type "${type}"`);
  return fieldObject.type;
};

// ─── §8 Host UI ──────────────────────────────────────────────────────────────
type FiberyHostBridge = {
  request: (method: string, params: unknown) => Promise<void>;
};

declare global {
  interface Window {
    __fiberyHost?: FiberyHostBridge;
  }
}

export type OpenEntityArgs = {
  type: string;
  publicId: string;
};

const entityPageUrl = ({type, publicId}: OpenEntityArgs): string =>
  `${window.location.origin}/${type.replace(/ /g, "_")}/${publicId}`;

export const openEntity = async (args: OpenEntityArgs): Promise<void> => {
  const host = window.__fiberyHost;
  if (host) {
    await host.request("open-entity", args);
    return;
  }
  window.open(entityPageUrl(args), "_blank", "noopener");
};
