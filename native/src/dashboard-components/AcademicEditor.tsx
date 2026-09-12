import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  type AcademicType,
  type Entity,
  isRecord,
  hydrateEntity,
} from "../../../src/data/academic";
import {
  createEntity,
  updateEntity,
  deleteEntity,
  setDocument,
  getDocument,
} from "../../../src/lib/fibery";
import { completeWorkItem } from "../../../src/completeWork";
import type { WorkItem } from "../../../src/dashboard";
import { transact, useWorkspace } from "../platform/workspace";
import { Button, Choice, Dialog, Field } from "./ui";
import { colors, styles as s } from "./theme";

export function workItem(
  row: Entity,
  type: AcademicType,
  data: ReturnType<typeof useWorkspace>["data"]["academic"],
): WorkItem {
  const item = hydrateEntity(row, data);
  const assignment = type === "University/Assignments";
  const context =
    item[assignment ? "University/Course" : "University/Category"];
  const tag = item[assignment ? "University/Priority" : "University/Category"];
  const state = item["workflow/state"];
  return {
    id: row["fibery/id"],
    publicId: String(row["fibery/public-id"]),
    name: row["University/Name"],
    type: assignment ? "Assignment" : "To-Do",
    dueDate: row["University/Due Date"] as string | null,
    state: isRecord(state) ? String(state["enum/name"]) : "Not Started",
    stateId: isRecord(state) ? String(state["fibery/id"]) : "",
    contextId: isRecord(context) ? String(context["fibery/id"]) : "",
    context: isRecord(context)
      ? String(context[assignment ? "University/Name" : "enum/name"])
      : "",
    tagId: isRecord(tag) ? String(tag["fibery/id"]) : "",
    tag: isRecord(tag) ? String(tag["enum/name"]) : "",
    contextColor: null,
    contextIcon: null,
    tagColor: null,
    tagIcon: null,
  };
}
export function AcademicEditor({
  type,
  item,
  onClose,
}: {
  type: AcademicType;
  item?: Entity;
  onClose: () => void;
}) {
  const { data, busy } = useWorkspace();
  const [draft, setDraft] = useState<Record<string, unknown>>(
    item
      ? { ...item }
      : { "University/Name": "", "University/Credit Hours": 3 },
  );
  const ref = item?.["University/Description"];
  const secret = isRecord(ref)
    ? String(ref["Collaboration~Documents/secret"])
    : "";
  const document = data.academic.documents[secret];
  const originalText =
    document?.localMarkdown ??
    document?.doc.content
      .map((node) =>
        (node.content ?? []).map((child) => child.text ?? "").join(""),
      )
      .join("\n") ??
    "";
  const [description, setDescription] = useState(originalText);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const assignment = type === "University/Assignments";
  const todo = type === "University/To-Dos";
  const course = type === "University/Courses";
  const note = type === "University/Dashboard Notes";
  const completed = type === "University/Completed Work";
  const textField = (key: string, label: string, multiline = false) => (
    <Field
      key={key}
      label={label}
      multiline={multiline}
      value={String(draft[key] ?? "")}
      onChangeText={(value) => setDraft({ ...draft, [key]: value })}
    />
  );
  const optionField = (key: string, label: string) => (
    <Choice
      key={key}
      label={label}
      value={isRecord(draft[key]) ? String(draft[key]["fibery/id"]) : ""}
      options={[
        { value: "", label: "Unassigned" },
        ...(data.academic.options[key] ?? []).map((option) => ({
          value: option.id,
          label: option.name,
        })),
      ]}
      onChange={(value) =>
        setDraft({ ...draft, [key]: value ? { "fibery/id": value } : null })
      }
    />
  );
  async function save() {
    if (!String(draft["University/Name"] ?? "").trim()) {
      setError("Name is required.");
      return;
    }
    const values: Record<string, unknown> = {
      ...draft,
      "University/Name": String(draft["University/Name"]).trim(),
    };
    if (course)
      values["University/Credit Hours"] = Number(
        values["University/Credit Hours"],
      );
    for (const key of [
      "University/Due Date",
      "University/Completion Date",
      "University/Original Due Date",
    ])
      if (key in values && !values[key]) values[key] = null;
    if (
      await transact(async () => {
        const saved = item
          ? await updateEntity<Entity>({ type, id: item["fibery/id"], values })
          : await createEntity<Entity>({ type, values });
        const savedRef = saved["University/Description"];
        if (!note && description !== originalText && isRecord(savedRef)) {
          const documentSecret = String(
            savedRef["Collaboration~Documents/secret"],
          );
          const original = await getDocument({ secret: documentSecret });
          await setDocument({
            secret: documentSecret,
            content: { ...original, localMarkdown: description },
          });
        }
      })
    )
      onClose();
  }
  return (
    <Dialog
      title={`${item ? "Edit" : "Add"} ${type.split("/")[1]}`}
      onClose={onClose}
      disabled={busy}
      dirty={
        JSON.stringify(draft) !==
          JSON.stringify(
            item ?? { "University/Name": "", "University/Credit Hours": 3 },
          ) || description !== originalText
      }
    >
      {textField("University/Name", "Name")}
      {(assignment || todo) &&
        textField("University/Due Date", "Due date (YYYY-MM-DD, optional)")}
      {course && (
        <>
          {textField("University/Credit Hours", "Credit hours")}
          {optionField("University/Academic Year", "Academic term")}
        </>
      )}
      {(assignment || completed) && (
        <>
          <Choice
            label="Course"
            value={
              isRecord(draft["University/Course"])
                ? String(draft["University/Course"]["fibery/id"])
                : ""
            }
            options={[
              { value: "", label: "No course" },
              ...data.academic.collections["University/Courses"].map((row) => ({
                value: row["fibery/id"],
                label: row["University/Name"],
              })),
            ]}
            onChange={(value) =>
              setDraft({
                ...draft,
                "University/Course": value ? { "fibery/id": value } : null,
              })
            }
          />
          {optionField("University/Priority", "Priority")}
        </>
      )}
      {(todo || completed) && optionField("University/Category", "Category")}
      {completed && (
        <>
          {textField(
            "University/Completion Date",
            "Completion date (YYYY-MM-DD)",
          )}
          {textField(
            "University/Original Due Date",
            "Original due date (YYYY-MM-DD)",
          )}
          {optionField("University/Type", "Type")}
        </>
      )}
      {note ? (
        textField("University/Markdown", "Markdown notes", true)
      ) : (
        <Field
          label="Description / Markdown"
          multiline
          value={description}
          onChangeText={setDescription}
        />
      )}
      {!!error && <Text style={{ color: colors.red }}>{error}</Text>}
      <View style={s.row}>
        <Button
          primary
          disabled={busy}
          onPress={() => {
            void save();
          }}
        >
          Save changes
        </Button>
        {item && (
          <Button disabled={busy} onPress={() => setDeleting(true)}>
            Delete
          </Button>
        )}
      </View>
      {deleting && (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text style={s.text}>Delete this record? This cannot be undone.</Text>
          <View style={s.row}>
            <Button
              disabled={busy}
              onPress={() => {
                void transact(async () => {
                  await deleteEntity({ type, id: item!["fibery/id"] });
                }).then((saved) => {
                  if (saved) onClose();
                });
              }}
            >
              Confirm deletion
            </Button>
            <Button onPress={() => setDeleting(false)}>Keep it</Button>
          </View>
        </View>
      )}
    </Dialog>
  );
}
export async function completeNativeWork(
  item: Entity,
  type: AcademicType,
  data: ReturnType<typeof useWorkspace>["data"]["academic"],
) {
  return transact(async () => {
    await completeWorkItem(workItem(item, type, data), {
      types: data.options["University/Type"],
      priorities: data.options["University/Priority"],
      categories: data.options["University/Category"],
    });
  }, "Moved to completed work.");
}
