import { useDeferredValue, useMemo, useState } from "react";
import { needsReview, type Internship } from "../internships/model";
import { useWorkspace } from "../platform/workspace";
import { Button, Field, Metrics } from "./ui";
import { colors, styles } from "./theme";
import { InternshipEditor } from "./InternshipEditor";
import { SemesterChart } from "./SemesterChart";

export function Internships({ onImport }: { onImport: () => void }) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Internship | "new" | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const items = data.internships.internships;
  const filtered = useMemo(() => items.filter((item) => !deferredQuery || [item.company, item.role, item.location, item.notes].some((value) => value.toLowerCase().includes(deferredQuery))), [items, deferredQuery]);
  const applied = items.filter((item) => item.appliedDate).length;
  const accepted = items.filter((item) => item.outcome === "accepted").length;
  const review = items.filter((item) => needsReview(item)).length;

  return (
    <div style={styles.page}>
      <div style={styles.spread}>
        <div>
          <text style={styles.eyebrow}>CAREER PIPELINE</text>
          <text role="heading" aria-level={1} style={styles.title}>Internships</text>
          <text style={styles.muted}>Track opportunities, applications, and outcomes in the local SQL workspace.</text>
        </div>
        <div style={styles.row}>
          <Button onPress={onImport}>Import</Button>
          <Button primary onPress={() => setEditing("new")}>Add internship</Button>
        </div>
      </div>
      <Metrics items={[
        { label: "Opportunities", value: items.length, color: colors.purple },
        { label: "Applications", value: applied, color: colors.teal },
        { label: "Accepted", value: accepted, color: colors.green },
        { label: "Needs review", value: review, color: colors.yellow },
      ]} />
      <SemesterChart internships={items} settings={data.internships.settings} />
      {editing ? <InternshipEditor internship={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      <div style={styles.card}>
        <Field label="Search internships" value={query} onChange={setQuery} placeholder="Company, role, location, or notes" />
        {filtered.length === 0 ? <text style={styles.muted}>No matching internships.</text> : filtered.map((item) => (
          <div key={item.id} style={{ ...styles.spread, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.border }}>
            <div style={{ gap: 3, flexGrow: 1 }}>
              <text style={styles.text}>{item.company} · {item.role}</text>
              <text style={styles.muted}>{item.location || "Location not specified"} · {item.outcome} · {item.appliedDate || "not applied"}</text>
            </div>
            <Button onPress={() => setEditing(item)}>Edit</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
