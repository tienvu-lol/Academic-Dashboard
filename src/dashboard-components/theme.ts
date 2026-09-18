import type { GpuixTheme, StyleDesc } from "@gpuix/react";

export const colors = {
  background: "#171412",
  card: "#24201e",
  cardRaised: "#2b2623",
  sidebar: "#12100f",
  field: "#332e2a",
  border: "#463e38",
  text: "#eee5de",
  muted: "#aa9d94",
  teal: "#008eaa",
  mint: "#70d8c5",
  green: "#a3e635",
  red: "#f87171",
  purple: "#c4b5fd",
  grey: "#a8a29e",
  yellow: "#edcd7f",
};

export const gpuixTheme: GpuixTheme = {
  appearance: "dark",
  bg: colors.background,
  border: colors.border,
  text: colors.text,
  textMuted: colors.muted,
  accent: colors.mint,
};

export const styles = {
  app: { flexGrow: 1, flexDirection: "row", backgroundColor: colors.background },
  sidebar: { width: 232, padding: 20, backgroundColor: colors.sidebar, borderRightWidth: 1, borderColor: colors.border, gap: 10 },
  content: { flexGrow: 1, minWidth: 0 },
  page: { flexGrow: 1, padding: 28, gap: 20, overflowY: "scroll" },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 18, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: 650 },
  heading: { color: colors.text, fontSize: 17, fontWeight: 650 },
  text: { color: colors.text, fontSize: 14, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  eyebrow: { color: colors.muted, fontSize: 10, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  spread: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.text, padding: 10, fontSize: 14, minHeight: 40 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  button: { borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingLeft: 13, paddingRight: 13, paddingTop: 9, paddingBottom: 9, alignItems: "center", justifyContent: "center", cursor: "pointer", userSelect: "none", hover: { backgroundColor: colors.field, borderColor: colors.muted }, active: { opacity: 0.7 } },
  active: { backgroundColor: "#203831", borderColor: "#355146" },
  badge: { borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, backgroundColor: colors.field },
} satisfies Record<string, StyleDesc>;

export function mergeStyles(...values: Array<StyleDesc | false | null | undefined>): StyleDesc {
  return Object.assign({}, ...values.filter(Boolean));
}
