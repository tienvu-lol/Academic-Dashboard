import React, { useState } from "react";
import { Linking, ScrollView, Switch, Text, View } from "react-native";
import { ACADEMIC_TYPES, type AcademicType } from "../../../src/data/academic";
import {
  parseAcademicImport,
  previewAcademicImport,
  commitAcademicImport,
  type AcademicImport,
} from "../../../src/data/academicImport";
import {
  parseInternshipImport,
  SIMPLIFY_SOURCE,
} from "../../../src/internships/importing";
import {
  mergeInternships,
  parseDatabase,
  todayLocal,
  type Internship,
  type Availability,
  type SemesterSettings,
} from "../../../src/internships/model";
import type { Preferences } from "../../../src/dashboard";
import {
  files,
  exportWorkspace,
  reportError,
  transact,
  useWorkspace,
  validateWorkspace,
} from "../platform/workspace";
import { Button, Choice, Field } from "./ui";
import { styles as s, colors } from "./theme";

type Preview = {
  academic?: AcademicImport;
  internships?: Internship[];
  preferences?: Preferences;
  settings?: SemesterSettings;
  added: number;
  skipped: number;
  warnings: string[];
  names: string[];
};
export function Imports() {
  const { data, busy } = useWorkspace();
  const [target, setTarget] = useState("internships");
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("import.json");
  const [snapshotDate, setSnapshotDate] = useState(todayLocal());
  const [availability, setAvailability] = useState<Availability>("open");
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState("");
  const [restoreSettings, setRestoreSettings] = useState(false);
  function inspect(input = text, name = filename) {
    setPreview(undefined);
    setError("");
    try {
      let academic: AcademicImport | undefined;
      let internships: Internship[] | undefined;
      let preferences: Preferences | undefined;
      let settings: SemesterSettings | undefined;
      const warnings: string[] = [];
      let sourceSkipped = 0;
      let parsed: any;
      if (/^\s*\{/.test(input)) {
        try {
          parsed = JSON.parse(input);
        } catch {
          /* parser below reports the error */
        }
      }
      if (parsed?.format === "academic-dashboard-windows") {
        validateWorkspace(parsed);
        academic = { kind: "backup", data: parsed.academic };
        internships = parsed.internships.internships;
        preferences = parsed.preferences;
        settings = parsed.internships.settings;
      } else if (
        parsed?.format === "academic-dashboard" ||
        target !== "internships"
      )
        academic = parseAcademicImport(
          input,
          name,
          target === "internships"
            ? "University/Assignments"
            : (target as AcademicType),
        );
      else if (parsed?.version && Array.isArray(parsed.internships)) {
        const backup = parseDatabase(input);
        internships = backup.internships;
        settings = backup.settings;
      } else {
        const result = parseInternshipImport(input, {
          snapshotDate,
          availability,
          sourceName: name,
        });
        internships = result.items;
        sourceSkipped = result.skipped + result.duplicateCount;
        warnings.push(...result.warnings);
      }
      const a = academic ? previewAcademicImport(academic) : undefined;
      const i = internships
        ? mergeInternships(data.internships.internships, internships)
        : undefined;
      setPreview({
        academic,
        internships,
        preferences,
        settings,
        added: (a?.added ?? 0) + (i?.added ?? 0),
        skipped: sourceSkipped + (a?.skipped ?? 0) + (i?.duplicates ?? 0),
        warnings: [...warnings, ...(a?.warnings ?? [])],
        names: [
          ...(a?.names.map((row) => `${row.type}: ${row.name}`) ?? []),
          ...(internships
            ?.slice(0, 50)
            .map((row) => `${row.company} · ${row.role}`) ?? []),
        ],
      });
    } catch (e) {
      setError(String(e));
    }
  }
  async function pick() {
    try {
      const file = await files.PickImport();
      if (file) {
        setFilename(file.name);
        setText(file.text);
        inspect(file.text, file.name);
      }
    } catch (e) {
      setError(String(e));
    }
  }
  async function commit() {
    if (!preview) return;
    if (
      await transact((draft) => {
        if (preview.academic) commitAcademicImport(preview.academic);
        if (preview.internships)
          draft.internships.internships = mergeInternships(
            draft.internships.internships,
            preview.internships,
          ).items;
        if (restoreSettings) {
          if (preview.settings) draft.internships.settings = preview.settings;
          if (preview.preferences) draft.preferences = preview.preferences;
        }
      }, "Import saved on this device.")
    ) {
      setPreview(undefined);
      setText("");
    }
  }
  return (
    <ScrollView contentContainerStyle={s.page}>
      <View>
        <Text style={s.eyebrow}>YOUR DATA · YOUR DEVICE</Text>
        <Text accessibilityRole="header" style={s.title}>
          Import & backup
        </Text>
        <Text style={s.muted}>
          Preview files before adding records. Existing entries and manual
          internship statuses are preserved.
        </Text>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Bring your dashboard with you</Text>
        <Text style={s.text}>
          From the web dashboard, export both the academic backup and internship
          backup, then import each file here. Fibery CSV and JSON exports are
          also supported; import courses before assignments to resolve course
          links.
        </Text>
        <Text selectable style={s.muted}>
          Local workspace: {files.StoragePath()}
        </Text>
        <View style={s.row}>
          <Button disabled={busy} onPress={() => void exportWorkspace()}>
            Export complete backup
          </Button>
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Manual file import</Text>
        <Choice
          label="Import into"
          value={target}
          options={[
            { value: "internships", label: "Internship applications" },
            ...ACADEMIC_TYPES.map((value) => ({
              value,
              label: value.split("/")[1],
            })),
          ]}
          onChange={(value) => {
            setTarget(value);
            setPreview(undefined);
          }}
        />
        {target === "internships" && (
          <>
            <Text style={s.muted}>
              Download the raw README.md or listings JSON from SimplifyJobs,
              then choose that file. Relative listing ages use the snapshot date
              below. No background fetching runs.
            </Text>
            <Button
              onPress={() =>
                void Linking.openURL(SIMPLIFY_SOURCE).catch(reportError)
              }
            >
              Open Summer 2027 source
            </Button>
            <Field
              label="Source snapshot date (YYYY-MM-DD)"
              value={snapshotDate}
              onChangeText={(value) => {
                setSnapshotDate(value);
                setPreview(undefined);
              }}
            />
            <Choice
              label="Initial availability for new opportunities (your manual choice)"
              value={availability}
              options={[
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
              ]}
              onChange={(value) => {
                setAvailability(value as Availability);
                setPreview(undefined);
              }}
            />
          </>
        )}
        <Button disabled={busy} onPress={() => void pick()}>
          Choose CSV, JSON, or README file
        </Button>
        <Field
          label="Filename (use .csv for Fibery CSV)"
          value={filename}
          onChangeText={(value) => {
            setFilename(value);
            setPreview(undefined);
          }}
        />
        <Field
          label="Or paste file contents"
          multiline
          value={text}
          onChangeText={(value) => {
            setText(value);
            setPreview(undefined);
          }}
          style={{ maxHeight: 180 }}
        />
        <Button disabled={busy || !text.trim()} onPress={() => inspect()}>
          Preview import
        </Button>
        {!!error && (
          <Text selectable style={{ color: colors.red }}>
            {error}
          </Text>
        )}
      </View>
      {preview && (
        <View style={s.card}>
          <Text style={s.heading}>
            {preview.added} new records · {preview.skipped} duplicates or
            skipped rows
          </Text>
          {preview.warnings.map((warning, index) => (
            <Text key={index} style={s.muted}>
              {warning}
            </Text>
          ))}
          {preview.names.slice(0, 20).map((name, index) => (
            <Text key={index} style={s.text}>
              {name}
            </Text>
          ))}
          {preview.names.length > 20 && (
            <Text style={s.muted}>And {preview.names.length - 20} more…</Text>
          )}
          {!!preview.settings && (
            <View style={s.row}>
              <Switch
                accessibilityLabel="Restore backup settings"
                value={restoreSettings}
                onValueChange={setRestoreSettings}
              />
              <Text style={s.text}>
                Also restore backup semester settings
                {preview.preferences ? " and page preferences" : ""}
              </Text>
            </View>
          )}
          <Button
            primary
            disabled={
              busy || (!preview.added && !(restoreSettings && preview.settings))
            }
            onPress={() => void commit()}
          >
            Import {preview.added} records
            {restoreSettings && preview.settings ? " and settings" : ""}
          </Button>
        </View>
      )}
    </ScrollView>
  );
}
