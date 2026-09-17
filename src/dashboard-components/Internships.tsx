import React, { memo, useDeferredValue, useMemo, useState } from "react";
import { FlatList, Linking, Text, TextInput, View } from "react-native";
import {
  createInternship,
  needsReview,
  safeUrl,
  SEMESTERS,
  validateSettings,
  type Internship,
} from "../internships/model";
import { transact, useWorkspace, reportError } from "../platform/workspace";
import { Button, Choice, Dialog, Field, Metrics } from "./ui";
import { colors, styles as s } from "./theme";
import { InternshipEditor } from "./InternshipEditor";
import { SemesterChart } from "./SemesterChart";

const InternshipRow = memo(function InternshipRow({
  item,
  onEdit,
}: {
  item: Internship;
  onEdit: (item: Internship) => void;
}) {
  const color =
    item.outcome === "accepted"
      ? colors.green
      : item.outcome === "rejected"
        ? colors.red
        : item.outcome === "ghosted"
          ? colors.purple
          : colors.muted;
  return (
    <View
      style={[
        s.spread,
        {
          padding: 16,
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
      ]}
    >
      <View style={{ flex: 3, gap: 4 }}>
        <Text numberOfLines={1} style={[s.text, { fontWeight: "600" }]}>
          {item.company}
        </Text>
        <Text numberOfLines={1} style={s.muted}>
          {item.role}
        </Text>
        <Text numberOfLines={1} style={s.muted}>
          {item.location}
          {item.tags.length ? ` · ${item.tags.join(", ")}` : ""}
        </Text>
      </View>
      <Text
        style={[
          s.muted,
          {
            flex: 1,
            color: item.availability === "open" ? colors.mint : colors.muted,
          },
        ]}
      >
        {item.availability}
      </Text>
      <View style={{ flex: 1.3 }}>
        <Text style={s.muted}>{item.deadline || "No deadline"}</Text>
        {needsReview(item) && (
          <Text style={{ color: colors.yellow, fontSize: 11 }}>
            Needs review
          </Text>
        )}
      </View>
      <View style={{ flex: 1.3 }}>
        <Text style={[s.muted, { color }]}>
          {item.appliedDate
            ? item.outcome === "pending"
              ? "Awaiting response"
              : item.outcome
            : "Not applied"}
        </Text>
        <Text style={s.muted}>{item.appliedDate}</Text>
      </View>
      <Button onPress={() => onEdit(item)}>Edit</Button>
      {!!safeUrl(item.url) && (
        <Button
          onPress={() => {
            void Linking.openURL(safeUrl(item.url)).catch(reportError);
          }}
        >
          Open ↗
        </Button>
      )}
    </View>
  );
});
export function Internships({ onImport }: { onImport: () => void }) {
  const { data, busy } = useWorkspace();
  const { internships: items, settings } = data.internships;
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.toLowerCase());
  const [view, setView] = useState("all");
  const [editing, setEditing] = useState<Internship | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [settingsError, setSettingsError] = useState("");
  const [sort, setSort] = useState("deadline");
  const filtered = useMemo(
    () =>
      items
        .filter((item) =>
          `${item.company} ${item.role} ${item.location} ${item.notes} ${item.tags.join(" ")}`
            .toLowerCase()
            .includes(query),
        )
        .filter((item) =>
          view === "open" || view === "closed"
            ? item.availability === view
            : view === "applied"
              ? !!item.appliedDate
              : view === "review"
                ? needsReview(item)
                : view === "outcomes"
                  ? item.outcome !== "pending"
                  : ["accepted", "rejected", "ghosted"].includes(view)
                    ? item.outcome === view
                    : true,
        )
        .sort((a, b) =>
          sort === "company"
            ? a.company.localeCompare(b.company)
            : (a.deadline || "9999").localeCompare(b.deadline || "9999"),
        ),
    [items, query, view, sort],
  );
  const counts = useMemo(
    () => ({
      sent: items.filter((item) => item.appliedDate).length,
      accepted: items.filter((item) => item.outcome === "accepted").length,
      rejected: items.filter((item) => item.outcome === "rejected").length,
      ghosted: items.filter((item) => item.outcome === "ghosted").length,
    }),
    [items],
  );
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        contentContainerStyle={{ padding: 28 }}
        ListHeaderComponent={
          <View style={{ gap: 20, paddingBottom: 15 }}>
            <View style={s.spread}>
              <View>
                <Text style={s.eyebrow}>YOUR NEXT CHAPTER</Text>
                <Text accessibilityRole="header" style={s.title}>
                  Internship applications
                </Text>
                <Text style={s.muted}>
                  Your opportunities, progress, and next steps.
                </Text>
              </View>
              <View style={s.row}>
                <Button
                  onPress={() => {
                    setDraftSettings(settings);
                    setCustomizing(true);
                  }}
                >
                  Customize
                </Button>
                <Button onPress={onImport}>Import</Button>
                <Button
                  primary
                  disabled={busy}
                  onPress={() => setEditing(createInternship())}
                >
                  + Add internship
                </Button>
              </View>
            </View>
            <Metrics
              items={[
                { label: "Opportunities", value: items.length },
                {
                  label: "Applications sent",
                  value: counts.sent,
                  color: colors.purple,
                },
                {
                  label: "Accepted",
                  value: counts.accepted,
                  color: colors.green,
                },
                {
                  label: "Rejected",
                  value: counts.rejected,
                  color: colors.red,
                  detail: `${counts.ghosted} ghosted`,
                },
              ]}
            />
            <SemesterChart items={items} settings={settings} />
            <View style={s.card}>
              <Text style={s.heading}>
                {view === "outcomes"
                  ? "Outcomes & follow-through"
                  : "Your opportunities"}
              </Text>
              <Text style={s.muted}>
                Deadlines flag pending applications for review. Availability and
                outcomes never change automatically.
              </Text>
              <TextInput
                accessibilityLabel="Search internships"
                placeholder="Search company, role, tags or notes"
                placeholderTextColor={colors.muted}
                value={search}
                onChangeText={setSearch}
                style={s.input}
              />
              <View style={s.row}>
                {[
                  { value: "all", label: "All" },
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed" },
                  { value: "applied", label: "Applied" },
                  { value: "review", label: "Needs review" },
                  { value: "outcomes", label: "Outcomes" },
                  { value: "accepted", label: "Accepted" },
                  { value: "rejected", label: "Rejected" },
                  { value: "ghosted", label: "Ghosted" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    primary={view === option.value}
                    onPress={() => setView(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </View>
              <Choice
                label="Sort"
                value={sort}
                options={[
                  { value: "deadline", label: "Deadline first" },
                  { value: "company", label: "Company A–Z" },
                ]}
                onChange={setSort}
              />
              <Text style={s.muted}>
                {filtered.length} records · rows load as you scroll
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <InternshipRow item={item} onEdit={setEditing} />
        )}
        ListEmptyComponent={
          <View style={s.card}>
            <Text style={s.muted}>
              No records in this view. Import a Simplify README or add an
              opportunity.
            </Text>
          </View>
        }
      />
      {editing && (
        <InternshipEditor item={editing} onClose={() => setEditing(null)} />
      )}
      {customizing && (
        <Dialog
          title="Customize internships"
          dirty={JSON.stringify(draftSettings) !== JSON.stringify(settings)}
          onClose={() => setCustomizing(false)}
          disabled={busy}
        >
          <Choice
            label="Semester preset"
            value={draftSettings.name}
            options={SEMESTERS.map((term) => ({
              value: term.name,
              label: term.name,
            }))}
            onChange={(name) => {
              const term = SEMESTERS.find((item) => item.name === name);
              if (term) setDraftSettings({ ...draftSettings, ...term });
            }}
          />
          <Field
            label="Semester name"
            value={draftSettings.name}
            onChangeText={(name) =>
              setDraftSettings({ ...draftSettings, name })
            }
          />
          <Field
            label="First day (YYYY-MM-DD)"
            value={draftSettings.start}
            onChangeText={(start) =>
              setDraftSettings({ ...draftSettings, start })
            }
          />
          <Field
            label="Last day (YYYY-MM-DD)"
            value={draftSettings.end}
            onChangeText={(end) => setDraftSettings({ ...draftSettings, end })}
          />
          <Field
            label="Application goal"
            value={String(draftSettings.goal)}
            keyboardType="numeric"
            onChangeText={(goal) =>
              setDraftSettings({ ...draftSettings, goal: Number(goal) })
            }
          />
          {!!settingsError && (
            <Text style={{ color: colors.red }}>{settingsError}</Text>
          )}
          <Button
            primary
            disabled={busy}
            onPress={() => {
              const error = validateSettings(draftSettings);
              if (error) {
                setSettingsError(error);
                return;
              }
              void transact((workspace) => {
                workspace.internships.settings = draftSettings;
              }).then((saved) => {
                if (saved) setCustomizing(false);
              });
            }}
          >
            Save preferences
          </Button>
        </Dialog>
      )}
    </View>
  );
}
