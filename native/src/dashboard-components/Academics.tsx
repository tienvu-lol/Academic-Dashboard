import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View, Switch } from "react-native";
import {
  ACADEMIC_TYPES,
  type AcademicType,
  type Entity,
  hydrateEntity,
  isRecord,
} from "../../../src/data/academic";
import { dateKey, type Preferences } from "../../../src/dashboard";
import { updateEntity } from "../../../src/lib/fibery";
import { useWorkspace, transact } from "../platform/workspace";
import { AcademicEditor, completeNativeWork } from "./AcademicEditor";
import { Button, Choice, Dialog, Metrics } from "./ui";
import { colors, styles as s } from "./theme";

export function Academics() {
  const { data, busy } = useWorkspace();
  const { academic, preferences } = data;
  const [type, setType] = useState<AcademicType>("University/Assignments");
  const [editing, setEditing] = useState<{
    type: AcademicType;
    item?: Entity;
  } | null>(null);
  const [filter, setFilter] = useState("active");
  const [selectedDay, setSelectedDay] = useState("");
  const [customizing, setCustomizing] = useState(false);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const today = dateKey(new Date());
  const records = useMemo(
    () =>
      academic.collections[type]
        .map((row) => hydrateEntity(row, academic))
        .filter(
          (row) =>
            !selectedDay ||
            (row["University/Due Date"] ??
              row["University/Original Due Date"] ??
              row["University/Completion Date"]) === selectedDay,
        )
        .filter(
          (row) =>
            filter === "all" ||
            (type !== "University/Assignments" &&
              type !== "University/To-Dos") ||
            !isRecord(row["workflow/state"]) ||
            row["workflow/state"]["enum/name"] !== "Done",
        )
        .sort((a, b) =>
          String(a["University/Due Date"] ?? "").localeCompare(
            String(b["University/Due Date"] ?? ""),
          ),
        ),
    [academic, type, filter, selectedDay],
  );
  const active = useMemo(
    () =>
      [
        ...(preferences.showAssignments
          ? academic.collections["University/Assignments"]
          : []),
        ...(preferences.showTodos
          ? academic.collections["University/To-Dos"]
          : []),
      ]
        .map((row) => hydrateEntity(row, academic))
        .filter(
          (row) =>
            !isRecord(row["workflow/state"]) ||
            row["workflow/state"]["enum/name"] !== "Done",
        ),
    [academic, preferences],
  );
  const completionDays = useMemo(() => {
    const counts = new Map<string, number>();
    academic.collections["University/Completed Work"].forEach((row) => {
      const day = String(row["University/Completion Date"] ?? "");
      counts.set(day, (counts.get(day) ?? 0) + 1);
    });
    return counts;
  }, [academic]);
  const dueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    active.forEach((row) => {
      const day = String(row["University/Due Date"] ?? "");
      counts.set(day, (counts.get(day) ?? 0) + 1);
    });
    return counts;
  }, [active]);
  const monthDays = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const weekdayOffset =
    (month.getDay() + (preferences.mondayFirst ? 6 : 0)) % 7;
  const monthKey = dateKey(month).slice(0, 7);
  const completedMonth = [...completionDays].filter(([day]) =>
    day.startsWith(monthKey),
  );
  const maximum = Math.max(1, ...completedMonth.map(([, count]) => count));
  const note = academic.collections["University/Dashboard Notes"][0];
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={records}
        keyExtractor={(row) => row["fibery/id"]}
        initialNumToRender={15}
        windowSize={5}
        contentContainerStyle={{ padding: 28 }}
        ListHeaderComponent={
          <View style={{ gap: 20, paddingBottom: 16 }}>
            <View style={s.spread}>
              <View>
                <Text style={s.eyebrow}>ACADEMIC DASHBOARD</Text>
                <Text accessibilityRole="header" style={s.title}>
                  Good{" "}
                  {new Date().getHours() < 12
                    ? "morning"
                    : new Date().getHours() < 18
                      ? "afternoon"
                      : "evening"}
                </Text>
                <Text style={s.muted}>
                  {new Date().toLocaleDateString()} · Plan, edit, and finish
                  work in one place.
                </Text>
              </View>
              <View style={s.row}>
                <Button onPress={() => setCustomizing(true)}>Customize</Button>
                <Button
                  primary
                  disabled={busy}
                  onPress={() => setEditing({ type })}
                >
                  + Add item
                </Button>
              </View>
            </View>
            <Metrics
              items={[
                {
                  label: "Due today",
                  value: active.filter(
                    (row) => row["University/Due Date"] === today,
                  ).length,
                  color: colors.yellow,
                },
                { label: "Open workload", value: active.length },
                {
                  label: "Completed today",
                  value: completionDays.get(today) ?? 0,
                  color: colors.green,
                },
                {
                  label: "Total credits",
                  value: academic.collections["University/Courses"].reduce(
                    (sum, row) =>
                      sum + Number(row["University/Credit Hours"] ?? 0),
                    0,
                  ),
                  color: colors.purple,
                },
              ]}
            />
            {preferences.showNotes && (
              <View style={s.card}>
                <View style={s.spread}>
                  <Text style={s.heading}>
                    {note?.["University/Name"] ?? "Dashboard notes"}
                  </Text>
                  <View style={s.row}>
                    <Button
                      onPress={() =>
                        setEditing({ type: "University/Dashboard Notes" })
                      }
                    >
                      + New note
                    </Button>
                    {!!note && (
                      <Button
                        onPress={() =>
                          setEditing({
                            type: "University/Dashboard Notes",
                            item: note,
                          })
                        }
                      >
                        Edit note
                      </Button>
                    )}
                  </View>
                </View>
                <Text
                  numberOfLines={7}
                  style={[s.text, { fontFamily: "Consolas", lineHeight: 22 }]}
                >
                  {String(
                    note?.["University/Markdown"] ??
                      "Keep your thoughts and next steps here.",
                  )}
                </Text>
              </View>
            )}
            <View style={s.card}>
              <View style={s.spread}>
                <Text style={s.heading}>Workload calendar</Text>
                <View style={s.row}>
                  <Button
                    onPress={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      )
                    }
                  >
                    Previous
                  </Button>
                  <Text style={s.text}>
                    {month.toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                  <Button
                    onPress={() =>
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      )
                    }
                  >
                    Next
                  </Button>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {(preferences.mondayFirst
                  ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                  : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                ).map((day) => (
                  <Text
                    key={day}
                    style={[s.muted, { width: "14.285%", padding: 8 }]}
                  >
                    {day}
                  </Text>
                ))}
                {Array.from(
                  { length: Math.ceil((weekdayOffset + monthDays) / 7) * 7 },
                  (_, index) => {
                    const day = index - weekdayOffset + 1;
                    const key = `${monthKey}-${String(day).padStart(2, "0")}`;
                    const count = dueCounts.get(key) ?? 0;
                    const valid = day >= 1 && day <= monthDays;
                    return (
                      <Pressable
                        key={index}
                        disabled={!valid}
                        accessibilityRole="button"
                        accessibilityLabel={
                          valid ? `${key}, ${count} items due` : "Outside month"
                        }
                        onPress={() => {
                          setSelectedDay(selectedDay === key ? "" : key);
                        }}
                        style={{
                          width: "14.285%",
                          minHeight: 66,
                          padding: 8,
                          borderWidth: 1,
                          borderColor:
                            selectedDay === key ? colors.mint : colors.border,
                          backgroundColor: count
                            ? "#58394b"
                            : colors.background,
                        }}
                      >
                        <Text
                          style={[
                            s.text,
                            {
                              color: key === today ? colors.mint : colors.text,
                            },
                          ]}
                        >
                          {valid ? day : ""}
                        </Text>
                        {!!count && valid && (
                          <Text style={s.muted}>{count} due</Text>
                        )}
                      </Pressable>
                    );
                  },
                )}
              </View>
              <View style={s.row}>
                <Text style={s.muted}>
                  Select a day to filter the list below.
                </Text>
                {!!selectedDay && (
                  <Button onPress={() => setSelectedDay("")}>
                    Clear date filter
                  </Button>
                )}
              </View>
            </View>
            {preferences.showMomentum && (
              <View style={s.card}>
                <Text style={s.heading}>
                  Monthly momentum ·{" "}
                  {completedMonth.reduce((sum, [, count]) => sum + count, 0)}{" "}
                  completed
                </Text>
                <View
                  style={{
                    height: 100,
                    flexDirection: "row",
                    alignItems: "flex-end",
                    gap: 3,
                  }}
                >
                  {Array.from({ length: monthDays }, (_, index) => {
                    const count =
                      completionDays.get(
                        `${monthKey}-${String(index + 1).padStart(2, "0")}`,
                      ) ?? 0;
                    return (
                      <View
                        key={index}
                        accessibilityLabel={`${index + 1}: ${count} completed`}
                        style={{
                          flex: 1,
                          height: Math.max(2, (count / maximum) * 100),
                          backgroundColor: count ? colors.green : colors.border,
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            )}
            {preferences.showCourses &&
              academic.collections["University/Courses"].length > 0 && (
                <View style={s.card}>
                  <Text style={s.heading}>Degree map</Text>
                  <View style={s.row}>
                    {academic.collections["University/Courses"].map((row) => {
                      const course = hydrateEntity(row, academic);
                      const term = course["University/Academic Year"];
                      return (
                        <Button
                          key={row["fibery/id"]}
                          onPress={() =>
                            setEditing({
                              type: "University/Courses",
                              item: row,
                            })
                          }
                        >
                          {row["University/Name"]} ·{" "}
                          {String(row["University/Credit Hours"] ?? 0)} credits
                          ·{" "}
                          {isRecord(term)
                            ? String(term["enum/name"])
                            : "Unassigned"}
                        </Button>
                      );
                    })}
                  </View>
                </View>
              )}
            <View style={s.card}>
              <Text style={s.heading}>Work, courses & notes</Text>
              <View style={s.row}>
                {ACADEMIC_TYPES.filter(
                  (value) =>
                    (value !== "University/Assignments" ||
                      preferences.showAssignments) &&
                    (value !== "University/To-Dos" || preferences.showTodos),
                ).map((value) => (
                  <Button
                    key={value}
                    primary={type === value}
                    onPress={() => {
                      setType(value);
                      setSelectedDay("");
                    }}
                  >
                    {value.split("/")[1]}
                  </Button>
                ))}
              </View>
              <View style={s.row}>
                <Button
                  onPress={() =>
                    setFilter(filter === "active" ? "all" : "active")
                  }
                >
                  {filter === "active"
                    ? "Show completed originals too"
                    : "Hide completed originals"}
                </Button>
                <Text style={s.muted}>
                  {records.length} records
                  {selectedDay ? ` · ${selectedDay}` : ""}
                </Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              s.spread,
              {
                padding: preferences.compact ? 10 : 16,
                backgroundColor: colors.card,
                borderBottomWidth: 1,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.text}>{item["University/Name"]}</Text>
              <Text style={s.muted}>
                {String(
                  item["University/Due Date"] ??
                    item["University/Completion Date"] ??
                    "",
                )}
                {isRecord(item["workflow/state"])
                  ? ` · ${String(item["workflow/state"]["enum/name"])}`
                  : ""}
              </Text>
            </View>
            {(type === "University/Assignments" ||
              type === "University/To-Dos") && (
              <>
                <Button
                  disabled={busy}
                  onPress={() => {
                    const next = academic.options["workflow/state"].find(
                      (option) => option.name === "In Progress",
                    );
                    if (next)
                      void transact(async () => {
                        await updateEntity({
                          type,
                          id: item["fibery/id"],
                          values: {
                            "workflow/state": { "fibery/id": next.id },
                          },
                        });
                      });
                  }}
                >
                  In progress
                </Button>
                <Button
                  disabled={busy}
                  onPress={() => {
                    void completeNativeWork(item, type, academic);
                  }}
                >
                  Complete
                </Button>
              </>
            )}
            <Button onPress={() => setEditing({ type, item })}>Edit</Button>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.card}>
            <Text style={s.muted}>
              No records here yet. Add an item or import your Fibery exports.
            </Text>
          </View>
        }
      />
      {editing && (
        <AcademicEditor {...editing} onClose={() => setEditing(null)} />
      )}
      {customizing && (
        <Dialog
          title="Customize academics"
          onClose={() => setCustomizing(false)}
          disabled={busy}
        >
          {(
            [
              "showAssignments",
              "showTodos",
              "showNotes",
              "showMomentum",
              "showCourses",
              "compact",
              "mondayFirst",
            ] as Array<keyof Preferences>
          ).map((key) => (
            <View key={key} style={[s.spread, { paddingVertical: 10 }]}>
              <Text style={s.text}>
                {
                  (
                    {
                      showAssignments: "Assignments",
                      showTodos: "To-dos",
                      showNotes: "Notes",
                      showMomentum: "Monthly momentum",
                      showCourses: "Degree map",
                      compact: "Compact rows",
                      mondayFirst: "Week starts Monday",
                    } as Record<string, string>
                  )[key]
                }
              </Text>
              <Switch
                accessibilityLabel={key}
                disabled={busy}
                value={preferences[key]}
                onValueChange={(value) => {
                  void transact((workspace) => {
                    workspace.preferences[key] = value;
                  });
                }}
              />
            </View>
          ))}
          <Text style={s.muted}>Google Calendar import is disabled.</Text>
        </Dialog>
      )}
    </View>
  );
}
