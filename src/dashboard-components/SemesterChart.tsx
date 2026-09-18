import { semesterSeries, type Internship, type SemesterSettings } from "../internships/model";
import { colors, styles } from "./theme";

export function SemesterChart({ internships, settings }: { internships: Internship[]; settings: SemesterSettings }) {
  const points = semesterSeries(internships, settings).filter((_, index, all) => index % Math.max(1, Math.ceil(all.length / 12)) === 0);
  const max = Math.max(1, ...points.map((point) => point.opportunities ?? 0));
  return (
    <div style={styles.card}>
      <text style={styles.heading}>Semester progress</text>
      <div style={{ flexDirection: "row", alignItems: "flex-end", height: 150, gap: 5 }}>
        {points.map((point) => (
          <div key={point.date} style={{ flexGrow: 1, gap: 4, justifyContent: "flex-end" }}>
            <div style={{ height: Math.max(2, ((point.opportunities ?? 0) / max) * 110), backgroundColor: colors.teal, borderRadius: 3 }} />
            <text style={{ ...styles.muted, fontSize: 9 }}>{point.date.slice(5)}</text>
          </div>
        ))}
      </div>
    </div>
  );
}
