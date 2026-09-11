import {
  createEntity,
  deleteEntity,
  getDocument,
  getEntityById,
  getSingleSelectOptions,
  setDocument,
  type SelectItem,
  type SelectOption,
} from "./lib/fibery";
import {dateKey, type CompletedWork, type WorkItem} from "./dashboard";

export type CompletionOptions = {
  types: SelectOption[];
  priorities: SelectOption[];
  categories: SelectOption[];
};

type EntityDocument = {
  "University/Description": {"Collaboration~Documents/secret": string} | null;
};

const completedFields: SelectItem[] = [
  "fibery/id",
  "fibery/public-id",
  "University/Name",
  "University/Completion Date",
  "University/Original Due Date",
  {"University/Course": ["fibery/id", "University/Name"]},
  {"University/Category": ["fibery/id", "enum/name", "enum/color", "enum/icon"]},
  {"University/Priority": ["fibery/id", "enum/name", "enum/color", "enum/icon"]},
  {"University/Type": ["fibery/id", "enum/name", "enum/color", "enum/icon"]},
  {"University/Description": ["Collaboration~Documents/secret"]},
];

function optionKey(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).sort().join("/");
}

function findOption(options: SelectOption[], name: string) {
  const exact = options.find((option) => option.name.toLowerCase() === name.toLowerCase());
  return exact ?? options.find((option) => optionKey(option.name) === optionKey(name));
}

async function ensureOptions(options: CompletionOptions) {
  const [types, priorities, categories] = await Promise.all([
    options.types.length ? options.types : getSingleSelectOptions({type: "University/Completed Work", field: "University/Type"}),
    options.priorities.length ? options.priorities : getSingleSelectOptions({type: "University/Completed Work", field: "University/Priority"}),
    options.categories.length ? options.categories : getSingleSelectOptions({type: "University/Completed Work", field: "University/Category"}),
  ]);
  return {types, priorities, categories};
}

export async function completeWorkItem(item: WorkItem, available: CompletionOptions): Promise<CompletedWork> {
  const options = await ensureOptions(available);
  const typeOption = findOption(options.types, item.type);
  if (!typeOption) throw new Error(`Completed Work is missing the “${item.type}” type option.`);

  const values: Record<string, unknown> = {
    "University/Name": item.name.trim(),
    "University/Completion Date": dateKey(new Date()),
    "University/Original Due Date": item.dueDate,
    "University/Type": {"fibery/id": typeOption.id},
  };

  if (item.type === "Assignment") {
    if (item.contextId) values["University/Course"] = {"fibery/id": item.contextId};
    if (item.tagId) {
      const priority = findOption(options.priorities, item.tag);
      if (!priority) throw new Error(`Completed Work is missing the “${item.tag}” priority option.`);
      values["University/Priority"] = {"fibery/id": priority.id};
    }
  } else if (item.contextId) {
    const category = findOption(options.categories, item.context);
    if (!category) throw new Error(`Completed Work is missing a category matching “${item.context}”.`);
    values["University/Category"] = {"fibery/id": category.id};
  }

  const created = await createEntity<{"fibery/id": string}>({type: "University/Completed Work", values});
  const archiveId = created["fibery/id"];
  if (!archiveId) throw new Error("Fibery created the completed record without returning its id.");

  try {
    const sourceType = item.type === "Assignment" ? "University/Assignments" : "University/To-Dos";
    const [source, archive] = await Promise.all([
      getEntityById<EntityDocument>({
        type: sourceType,
        id: item.id,
        fields: [{"University/Description": ["Collaboration~Documents/secret"]}],
      }),
      getEntityById<CompletedWork & EntityDocument>({
        type: "University/Completed Work",
        id: archiveId,
        fields: [...completedFields],
      }),
    ]);
    if (!archive) throw new Error("The completed record could not be verified after creation.");

    const sourceSecret = source?.["University/Description"]?.["Collaboration~Documents/secret"];
    const archiveSecret = archive["University/Description"]?.["Collaboration~Documents/secret"];
    if (sourceSecret && archiveSecret) {
      const content = await getDocument({secret: sourceSecret});
      await setDocument({secret: archiveSecret, content});
    }

    await deleteEntity({type: sourceType, id: item.id});
    return archive;
  } catch (error) {
    try {
      await deleteEntity({type: "University/Completed Work", id: archiveId});
    } catch (rollbackError) {
      throw new Error(`${error instanceof Error ? error.message : String(error)} Rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
    throw error;
  }
}
