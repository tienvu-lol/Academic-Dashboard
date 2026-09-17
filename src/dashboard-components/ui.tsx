import React, { useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, styles as s } from "./theme";
import { useWorkspace } from "../platform/workspace";
export function Button({
  children,
  onPress,
  primary = false,
  disabled = false,
}: {
  children: ReactNode;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onAccessibilityTap={() => {
        if (!disabled) onPress();
      }}
      accessibilityLabel={React.Children.toArray(children)
        .filter(
          (child) => typeof child === "string" || typeof child === "number",
        )
        .join("")}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        primary && { backgroundColor: colors.teal, borderColor: colors.teal },
        { opacity: disabled ? 0.4 : pressed ? 0.65 : 1 },
      ]}
    >
      <Text style={[s.text, { fontSize: 12 }, primary && { color: "#fff" }]}>
        {children}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 4, marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <Button onPress={() => setOpen(!open)}>
        {options.find((option) => option.value === value)?.label ??
          value ??
          "Choose"}{" "}
        ▾
      </Button>
      {open && (
        <ScrollView style={{ maxHeight: 200, backgroundColor: colors.field }}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="button"
              onAccessibilityTap={() => {
                onChange(option.value);
                setOpen(false);
              }}
              accessibilityState={{ selected: value === option.value }}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{ padding: 10 }}
            >
              <Text
                style={[
                  s.text,
                  value === option.value && { color: colors.mint },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  dirty = false,
  disabled = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
  disabled?: boolean;
}) {
  const { error } = useWorkspace();
  const [discard, setDiscard] = useState(false);
  const close = () => {
    if (!disabled) dirty ? setDiscard(true) : onClose();
  };
  return (
    <Modal transparent visible animationType="none" onRequestClose={close}>
      <View
        style={{
          flex: 1,
          padding: 24,
          backgroundColor: "#000b",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={[s.card, { width: "100%", maxWidth: 760, maxHeight: "92%" }]}
        >
          <View style={s.spread}>
            <Text accessibilityRole="header" style={s.heading}>
              {title}
            </Text>
            <Button disabled={disabled} onPress={close}>
              Close
            </Button>
          </View>
          {!!error && (
            <Text
              selectable
              accessibilityLiveRegion="assertive"
              style={{ color: colors.red }}
            >
              {error}
            </Text>
          )}
          {discard ? (
            <View style={{ gap: 14 }}>
              <Text style={s.text}>Discard unsaved changes?</Text>
              <View style={s.row}>
                <Button onPress={onClose}>Discard</Button>
                <Button primary onPress={() => setDiscard(false)}>
                  Keep editing
                </Button>
              </View>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
export function Metrics({
  items,
}: {
  items: Array<{
    label: string;
    value: number;
    detail?: string;
    color?: string;
  }>;
}) {
  return (
    <View style={[s.row, { alignItems: "stretch" }]}>
      {items.map((item) => (
        <View key={item.label} style={[s.card, { flex: 1, minWidth: 140 }]}>
          <Text style={s.muted}>{item.label}</Text>
          <Text
            style={{
              fontSize: 30,
              color: item.color ?? colors.text,
              fontWeight: "600",
            }}
          >
            {item.value}
          </Text>
          {item.detail && <Text style={s.muted}>{item.detail}</Text>}
        </View>
      ))}
    </View>
  );
}
