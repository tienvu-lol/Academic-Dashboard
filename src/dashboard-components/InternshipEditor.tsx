import { useMemo, useState } from "react";
import { createInternship, todayLocal, validateInternship, type Internship, type Outcome } from "../internships/model";
import { transact, useWorkspace } from "../platform/workspace";
import { Button, Choice, Dialog, Field } from "./ui";
import { colors, styles } from "./theme";

export function InternshipEditor({ internship, onClose }: { internship?: Internship; onClose: () => void }) {
  const { busy } = useWorkspace();
  const initial = useMemo(() => structuredClone(internship ?? createInternship()), [internship]);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const set = <K extends keyof Internship>(key: K, value: Internship[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  async function save() {
    const next = { ...draft, updatedAt: todayLocal() };
    const problem = validateInternship(next);
    if (problem) { setError(problem); return; }
    const saved = await transact((workspace) => {
      const index = workspace.internships.internships.findIndex((item) => item.id === next.id);
      if (index >= 0) workspace.internships.internships[index] = next;
      else workspace.internships.internships.push(next);
    }, "Internship saved to Bun SQL.");
    if (saved) onClose();
  }

  return (
    <Dialog title={internship ? "Edit internship" : "Add internship"} onClose={onClose} dirty={dirty} disabled={busy}>
      <div style={{ gap: 8 }}>
        <Field label="Company" value={draft.company} onChange={(value) => set("company", value)} />
        <Field label="Role" value={draft.role} onChange={(value) => set("role", value)} />
        <Field label="Location" value={draft.location} onChange={(value) => set("location", value)} />
        <Field label="Application URL" value={draft.url} onChange={(value) => set("url", value)} />
        <div style={styles.row}>
          <div style={{ flexGrow: 1, minWidth: 200 }}><Field label="Listed date" value={draft.listedDate} onChange={(value) => set("listedDate", value)} /></div>
          <div style={{ flexGrow: 1, minWidth: 200 }}><Field label="Deadline" value={draft.deadline} onChange={(value) => set("deadline", value)} /></div>
          <div style={{ flexGrow: 1, minWidth: 200 }}><Field label="Applied date" value={draft.appliedDate} onChange={(value) => set("appliedDate", value)} /></div>
          <div style={{ flexGrow: 1, minWidth: 200 }}><Field label="Outcome date" value={draft.outcomeDate} onChange={(value) => set("outcomeDate", value)} /></div>
        </div>
        <Choice label="Availability" value={draft.availability} onChange={(value) => set("availability", value as Internship["availability"])} options={[{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }]} />
        <Choice label="Outcome" value={draft.outcome} onChange={(value) => set("outcome", value as Outcome)} options={["pending", "ghosted", "rejected", "accepted"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} />
        <Field label="Notes" value={draft.notes} onChange={(value) => set("notes", value)} multiline />
        {error ? <text style={{ ...styles.text, color: colors.red }}>{error}</text> : null}
        <div style={styles.row}>
          <Button primary disabled={busy} onPress={() => void save()}>Save</Button>
          <Button disabled={busy} onPress={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  );
}
