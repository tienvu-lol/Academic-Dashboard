import { useState, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type StyleDesc } from "@gpuix/react";
import { colors, gpuixTheme, mergeStyles, styles } from "./theme";
import { useWorkspace } from "../platform/workspace";

export function Button({ children, onPress, primary = false, disabled = false, style }: {
  children: ReactNode;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  style?: StyleDesc;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? undefined : 0}
      aria-label={typeof children === "string" ? children : undefined}
      onClick={() => { if (!disabled) onPress(); }}
      style={mergeStyles(
        styles.button,
        primary && { backgroundColor: colors.teal, borderColor: colors.teal },
        disabled && { opacity: 0.4, cursor: "not-allowed" },
        style,
      )}
    >
      <text style={{ color: primary ? "#ffffff" : colors.text, fontSize: 12 }}>{children}</text>
    </div>
  );
}

export function Field({ label, value, onChange, placeholder, multiline = false, style }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  style?: StyleDesc;
}) {
  const shared = {
    value,
    placeholder,
    theme: gpuixTheme,
    onChange: (event: { value?: unknown }) => onChange(String(event.value ?? "")),
    style: mergeStyles(styles.input, multiline && { minHeight: 110 }, style),
    tabIndex: 0,
    "aria-label": label,
  };
  return (
    <div style={{ gap: 4, marginBottom: 10 }}>
      <text style={styles.label}>{label}</text>
      {multiline ? <textarea {...shared} minRows={4} maxRows={12} /> : <input {...shared} />}
    </div>
  );
}

export function Choice({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ marginBottom: 10, gap: 4 }}>
      <text style={styles.label}>{label}</text>
      <Select items={options} value={value} onValueChange={onChange}>
        <SelectTrigger style={styles.button} aria-label={label}>
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent style={{ ...styles.card, maxHeight: 260, overflowY: "scroll", backgroundColor: colors.cardRaised }}>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              style={({ selected, highlighted }) => mergeStyles(
                styles.button,
                selected && styles.active,
                highlighted && { backgroundColor: colors.field },
              )}
            >
              <text style={{ color: value === option.value ? colors.mint : colors.text }}>{option.label}</text>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div style={styles.row}>
      <Button onPress={() => onChange(!value)} primary={value}>{value ? "On" : "Off"}</Button>
      <text style={styles.text}>{label}</text>
    </div>
  );
}

export function Dialog({ title, children, onClose, dirty = false, disabled = false }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
  disabled?: boolean;
}) {
  const { error } = useWorkspace();
  const [discard, setDiscard] = useState(false);
  const close = () => { if (!disabled) dirty ? setDiscard(true) : onClose(); };
  return (
    <div style={{ ...styles.card, backgroundColor: colors.cardRaised, marginBottom: 18 }}>
      <div style={styles.spread}>
        <text role="heading" aria-level={2} style={styles.heading}>{title}</text>
        <Button disabled={disabled} onPress={close}>Close</Button>
      </div>
      {error ? <text style={{ ...styles.text, color: colors.red }}>{error}</text> : null}
      {discard ? (
        <div style={{ gap: 12 }}>
          <text style={styles.text}>Discard unsaved changes?</text>
          <div style={styles.row}>
            <Button onPress={onClose}>Discard</Button>
            <Button primary onPress={() => setDiscard(false)}>Keep editing</Button>
          </div>
        </div>
      ) : children}
    </div>
  );
}

export function Metrics({ items }: { items: Array<{ label: string; value: number; detail?: string; color?: string }> }) {
  return (
    <div style={{ ...styles.row, alignItems: "stretch" }}>
      {items.map((item) => (
        <div key={item.label} style={{ ...styles.card, flexGrow: 1, minWidth: 140 }}>
          <text style={styles.muted}>{item.label}</text>
          <text style={{ fontSize: 30, color: item.color ?? colors.text, fontWeight: 650 }}>{item.value}</text>
          {item.detail ? <text style={styles.muted}>{item.detail}</text> : null}
        </div>
      ))}
    </div>
  );
}
