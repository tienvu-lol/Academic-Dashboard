import { useMemo, useState } from "react";
import { ACADEMIC_TYPES, type AcademicType, type Entity } from "../data/academic";
import { useWorkspace } from "../platform/workspace";
import { AcademicEditor } from "./AcademicEditor";
import { Button, Metrics } from "./ui";
import { colors, styles } from "./theme";

const labels: Record<AcademicType, string> = {
  "University/Courses": "Courses",
  "University/Assignments": "Assignments",
  "University/To-Dos": "To-dos",
  "University/Completed Work": "Completed",
  "University/Dashboard Notes": "Notes",
};

function refName(value: unknown, field: string) {
  return value && typeof value === "object" ? String((value as Record<string, unknown>)[field] ?? "") : "";
}

export function Academics() {
  const { data } = useWorkspace();
  const [collection, setCollection] = useState<AcademicType>("University/Assignments");
  const [editing, setEditing] = useState<Entity | "new" | null>(null);
  const rows = data.academic.collections[collection];
  const due = useMemo(() => [
    ...data.academic.collections["University/Assignments"],
    ...data.academic.collections["University/To-Dos"],
  ], [data.academic]);
  const done = due.filter((item) => refName(item["workflow/state"], "enum/name") === "Done").length;

  return (
    <div style={styles.page}>
      <div>
        <text style={styles.eyebrow}>ACADEMIC WORKSPACE</text>
        <text role="heading" aria-level={1} style={styles.title}>Plan the semester</text>
        <text style={styles.muted}>Courses, assignments, and tasks are persisted in SQLite by Bun SQL.</text>
      </div>
      <Metrics items={[
        { label: "Courses", value: data.academic.collections["University/Courses"].length, color: colors.purple },
        { label: "Open work", value: due.length - done, color: colors.yellow },
        { label: "Completed", value: data.academic.collections["University/Completed Work"].length + done, color: colors.green },
      ]} />
      <div style={styles.row}>
        {ACADEMIC_TYPES.map((type) => (
          <Button key={type} primary={type === collection} onPress={() => { setCollection(type); setEditing(null); }}>{labels[type]}</Button>
        ))}
      </div>
      {editing ? (
        <AcademicEditor type={collection} entity={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      ) : null}
      <div style={styles.card}>
        <div style={styles.spread}>
          <text style={styles.heading}>{labels[collection]}</text>
          {!["University/Completed Work"].includes(collection) ? <Button primary onPress={() => setEditing("new")}>Add record</Button> : null}
        </div>
        {rows.length === 0 ? <text style={styles.muted}>No records yet.</text> : rows.map((row) => (
          <div key={row["fibery/id"]} style={{ ...styles.spread, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.border }}>
            <div style={{ gap: 3, flexGrow: 1 }}>
              <text style={styles.text}>{row["University/Name"]}</text>
              <text style={styles.muted}>
                {String(row["University/Due Date"] ?? row["University/Completion Date"] ?? "")}
                {refName(row["workflow/state"], "enum/name") ? ` · ${refName(row["workflow/state"], "enum/name")}` : ""}
              </text>
            </div>
            {collection !== "University/Completed Work" ? <Button onPress={() => setEditing(row)}>Edit</Button> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
