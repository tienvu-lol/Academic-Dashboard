import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  type Internship,
  validateInternship,
} from "../internships/model";
import { transact, useWorkspace } from "../platform/workspace";
import { Button, Choice, Dialog, Field } from "./ui";
import { colors, styles as s } from "./theme";

export function InternshipEditor({
  item,
  onClose,
}: {
  item: Internship;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(item);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data, busy } = useWorkspace();
  const exists = data.internships.internships.some((row) => row.id === item.id);
  const update = (key: keyof Internship, value: string) =>
    setDraft({ ...draft, [key]: value });
  async function save() {
    const next = {
      ...draft,
      updatedAt: new Date().toISOString(),
      company: draft.company.trim(),
      role: draft.role.trim(),
      outcomeDate: draft.outcome === "pending" ? "" : draft.outcomeDate,
      tags: [
        ...new Set(
          tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
    };
    const problem = validateInternship(next);
    if (problem) {
      setError(problem);
      return;
    }
    if (
      await transact((workspace) => {
        const rows = workspace.internships.internships;
        workspace.internships.internships = exists
          ? rows.map((row) => (row.id === next.id ? next : row))
          : [...rows, next];
      })
    )
      onClose();
  }
  return (
    <Dialog
      title={exists ? "Edit internship" : "Add internship"}
      onClose={onClose}
      dirty={
        JSON.stringify(draft) !== JSON.stringify(item) ||
        tags !== item.tags.join(", ")
      }
      disabled={busy}
    >
      <Field
        label="Company"
        value={draft.company}
        onChangeText={(value) => update("company", value)}
      />
      <Field
        label="Role"
        value={draft.role}
        onChangeText={(value) => update("role", value)}
      />
      <Field
        label="Location"
        value={draft.location}
        onChangeText={(value) => update("location", value)}
      />
      <Choice
        label="Availability — changed manually"
        value={draft.availability}
        options={[
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" },
        ]}
        onChange={(value) => update("availability", value)}
      />
      <Field
        label="Application link"
        value={draft.url}
        onChangeText={(value) => update("url", value)}
      />
      <Field
        label="Listed date (YYYY-MM-DD, blank if unknown)"
        value={draft.listedDate}
        onChangeText={(value) => update("listedDate", value)}
      />
      <Field
        label="Deadline (YYYY-MM-DD, optional)"
        value={draft.deadline}
        onChangeText={(value) => update("deadline", value)}
      />
      <Field
        label="Date sent (YYYY-MM-DD, blank until applied)"
        value={draft.appliedDate}
        onChangeText={(value) => update("appliedDate", value)}
      />
      <Choice
        label="Outcome"
        value={draft.outcome}
        options={["pending", "accepted", "rejected", "ghosted"].map(
          (value) => ({
            value,
            label: value === "pending" ? "Awaiting response" : value,
          }),
        )}
        onChange={(value) => update("outcome", value)}
      />
      {draft.outcome !== "pending" && (
        <Field
          label="Outcome date (YYYY-MM-DD)"
          value={draft.outcomeDate}
          onChangeText={(value) => update("outcomeDate", value)}
        />
      )}
      <Field
        label="Tags (comma separated)"
        value={tags}
        onChangeText={setTags}
      />
      <Field
        label="Notes"
        multiline
        value={draft.notes}
        onChangeText={(value) => update("notes", value)}
      />
      <Text style={s.muted}>Source: {item.sourceName}</Text>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.red }}>
          {error}
        </Text>
      )}
      <View style={[s.row, { marginTop: 15 }]}>
        <Button
          primary
          disabled={busy}
          onPress={() => {
            void save();
          }}
        >
          Save internship
        </Button>
        {exists && (
          <Button disabled={busy} onPress={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </View>
      {confirmDelete && (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text style={s.text}>
            Delete this internship and its recorded history?
          </Text>
          <View style={s.row}>
            <Button
              disabled={busy}
              onPress={() => {
                void transact((workspace) => {
                  workspace.internships.internships =
                    workspace.internships.internships.filter(
                      (row) => row.id !== item.id,
                    );
                }).then((saved) => {
                  if (saved) onClose();
                });
              }}
            >
              Confirm deletion
            </Button>
            <Button onPress={() => setConfirmDelete(false)}>Keep it</Button>
          </View>
        </View>
      )}
    </Dialog>
  );
}
