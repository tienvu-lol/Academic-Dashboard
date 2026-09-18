import { useState } from "react";
import { ACADEMIC_TYPES, type AcademicType } from "../data/academic";
import { commitAcademicImport, parseAcademicImport, previewAcademicImport, type AcademicImport } from "../data/academicImport";
import { parseInternshipImport } from "../internships/importing";
import { mergeInternships, parseDatabase, todayLocal, type Internship } from "../internships/model";
import { exportWorkspace, parseWorkspace, storagePath, transact, useWorkspace, type Workspace } from "../platform/workspace";
import { Button, Choice, Field } from "./ui";
import { colors, styles } from "./theme";

type Preview = {
  academic?: AcademicImport;
  internships?: Internship[];
  workspace?: Workspace;
  added: number;
  skipped: number;
  names: string[];
};

export function Imports() {
  const { data, busy } = useWorkspace();
  const [target, setTarget] = useState("internships");
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("import.json");
  const [snapshotDate, setSnapshotDate] = useState(todayLocal());
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState("");

  function inspect() {
    setError("");
    setPreview(undefined);
    try {
      let parsed: unknown;
      if (/^\s*\{/.test(text)) parsed = JSON.parse(text);
      if ((parsed as { format?: string } | undefined)?.format?.startsWith("academic-dashboard-workspace") || (parsed as { format?: string } | undefined)?.format === "academic-dashboard-windows") {
        const workspace = parseWorkspace(parsed);
        setPreview({ workspace, added: Object.values(workspace.academic.collections).reduce((sum, rows) => sum + rows.length, workspace.internships.internships.length), skipped: 0, names: ["Complete workspace backup"] });
        return;
      }
      if ((parsed as { format?: string } | undefined)?.format === "academic-dashboard" || target !== "internships") {
        const academic = parseAcademicImport(text, filename, target === "internships" ? "University/Assignments" : target as AcademicType);
        const result = previewAcademicImport(academic);
        setPreview({ academic, added: result.added, skipped: result.skipped, names: result.names.map((row) => `${row.type}: ${row.name}`) });
        return;
      }
      let internships: Internship[];
      if ((parsed as { version?: number; internships?: unknown[] } | undefined)?.version === 1) internships = parseDatabase(text).internships;
      else internships = parseInternshipImport(text, { snapshotDate, availability: "open", sourceName: filename }).items;
      const merged = mergeInternships(data.internships.internships, internships);
      setPreview({ internships, added: merged.added, skipped: merged.duplicates, names: internships.map((item) => `${item.company} · ${item.role}`) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function commit() {
    if (!preview) return;
    const saved = await transact((draft) => {
      if (preview.workspace) {
        draft.academic = preview.workspace.academic;
        draft.internships = preview.workspace.internships;
        draft.preferences = preview.workspace.preferences;
      } else {
        if (preview.academic) commitAcademicImport(preview.academic);
        if (preview.internships) draft.internships.internships = mergeInternships(draft.internships.internships, preview.internships).items;
      }
    }, "Import committed to Bun SQL.");
    if (saved) { setPreview(undefined); setText(""); }
  }

  return (
    <div style={styles.page}>
      <div>
        <text style={styles.eyebrow}>YOUR DATA · YOUR DEVICE</text>
        <text role="heading" aria-level={1} style={styles.title}>Import & backup</text>
        <text style={styles.muted}>Live data is stored in SQLite. JSON and CSV remain interchange formats only.</text>
      </div>
      <div style={styles.card}>
        <text style={styles.heading}>Bun SQL storage</text>
        <text style={styles.text}>{storagePath()}</text>
        <text style={styles.muted}>Exports are written beside the database as a complete JSON recovery backup.</text>
        <Button disabled={busy} onPress={() => void exportWorkspace()}>Export complete backup</Button>
      </div>
      <div style={styles.card}>
        <text style={styles.heading}>Import data</text>
        <Choice
          label="Import into"
          value={target}
          options={[{ value: "internships", label: "Internship applications" }, ...ACADEMIC_TYPES.map((value) => ({ value, label: value.split("/")[1] }))]}
          onChange={(value) => { setTarget(value); setPreview(undefined); }}
        />
        {target === "internships" ? <Field label="Source snapshot date (YYYY-MM-DD)" value={snapshotDate} onChange={(value) => { setSnapshotDate(value); setPreview(undefined); }} /> : null}
        <Field label="Filename" value={filename} onChange={(value) => { setFilename(value); setPreview(undefined); }} />
        <Field label="Paste JSON, CSV, Markdown, or HTML" value={text} onChange={(value) => { setText(value); setPreview(undefined); }} multiline style={{ minHeight: 180 }} />
        <Button disabled={busy || !text.trim()} onPress={inspect}>Preview import</Button>
        {error ? <text style={{ ...styles.text, color: colors.red }}>{error}</text> : null}
      </div>
      {preview ? (
        <div style={styles.card}>
          <text style={styles.heading}>{preview.added} records ready · {preview.skipped} duplicates or skipped</text>
          {preview.names.slice(0, 20).map((name, index) => <text key={`${name}-${index}`} style={styles.text}>{name}</text>)}
          {preview.names.length > 20 ? <text style={styles.muted}>And {preview.names.length - 20} more…</text> : null}
          <Button primary disabled={busy || (!preview.added && !preview.workspace)} onPress={() => void commit()}>Commit import</Button>
        </div>
      ) : null}
    </div>
  );
}
