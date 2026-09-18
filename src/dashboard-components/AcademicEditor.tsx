import { useMemo, useState } from "react";
import { createEntity, updateEntity } from "../lib/fibery";
import { optionId, type AcademicType, type Entity } from "../data/academic";
import { transact, useWorkspace } from "../platform/workspace";
import { Button, Choice, Dialog, Field } from "./ui";
import { styles } from "./theme";

export function AcademicEditor({ type, entity, onClose }: { type: AcademicType; entity?: Entity; onClose: () => void }) {
  const { busy } = useWorkspace();
  const [name, setName] = useState(String(entity?.["University/Name"] ?? ""));
  const [dueDate, setDueDate] = useState(String(entity?.["University/Due Date"] ?? ""));
  const [status, setStatus] = useState(String((entity?.["workflow/state"] as Record<string, unknown> | undefined)?.["fibery/id"] ?? optionId("workflow/state", "Not Started")));
  const [credits, setCredits] = useState(String(entity?.["University/Credit Hours"] ?? ""));
  const original = useMemo(() => JSON.stringify({ name, dueDate, status, credits }), []);
  const dirty = original !== JSON.stringify({ name, dueDate, status, credits });
  const title = type.split("/")[1].replace(/s$/, "");

  async function save() {
    if (!name.trim()) return;
    const values: Record<string, unknown> = { "University/Name": name.trim() };
    if (type === "University/Assignments" || type === "University/To-Dos") {
      values["University/Due Date"] = dueDate || null;
      values["workflow/state"] = { "fibery/id": status };
    }
    if (type === "University/Courses") values["University/Credit Hours"] = credits ? Number(credits) : null;
    const saved = await transact(async () => {
      if (entity) await updateEntity({ type, id: entity["fibery/id"], values });
      else await createEntity({ type, values });
    }, `${title} saved to Bun SQL.`);
    if (saved) onClose();
  }

  return (
    <Dialog title={`${entity ? "Edit" : "Add"} ${title}`} onClose={onClose} dirty={dirty} disabled={busy}>
      <div style={{ gap: 10 }}>
        <Field label="Name" value={name} onChange={setName} placeholder={`${title} name`} />
        {(type === "University/Assignments" || type === "University/To-Dos") ? (
          <>
            <Field label="Due date (YYYY-MM-DD)" value={dueDate} onChange={setDueDate} />
            <Choice
              label="Status"
              value={status}
              onChange={setStatus}
              options={["Not Started", "In Progress", "Done"].map((label) => ({ value: optionId("workflow/state", label), label }))}
            />
          </>
        ) : null}
        {type === "University/Courses" ? <Field label="Credit hours" value={credits} onChange={setCredits} /> : null}
        <div style={styles.row}>
          <Button primary disabled={busy || !name.trim()} onPress={() => void save()}>Save</Button>
          <Button disabled={busy} onPress={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  );
}
