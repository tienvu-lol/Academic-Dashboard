import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  semesterSeries,
  type Internship,
  type SemesterSettings,
  type SemesterPoint,
} from "../internships/model";
import { colors, styles as s } from "./theme";

const lines = [
  { key: "opportunities", label: "Total opportunities", color: colors.grey },
  { key: "sent", label: "Applications sent", color: colors.purple },
  { key: "accepted", label: "Accepted", color: colors.green },
  { key: "rejected", label: "Rejected", color: colors.red },
] as const;
export function SemesterChart({
  items,
  settings,
}: {
  items: Internship[];
  settings: SemesterSettings;
}) {
  const [width, setWidth] = useState(650);
  const data = useMemo(
    () => semesterSeries(items, settings),
    [items, settings],
  );
  const sentThisSemester = useMemo(
    () =>
      items.filter(
        (item) =>
          item.appliedDate >= settings.start &&
          item.appliedDate <= settings.end &&
          !!item.appliedDate,
      ).length,
    [items, settings],
  );
  const observedMax = Math.max(
    4,
    ...data.flatMap((point) => lines.map((line) => point[line.key] ?? 0)),
  );
  const max = Math.ceil(observedMax / 4) * 4;
  const height = 220;
  const segments = useMemo(
    () =>
      lines.flatMap((line) => {
        const result: Array<{
          key: string;
          x: number;
          y: number;
          w: number;
          h: number;
          color: string;
          glow: boolean;
        }> = [];
        let start = 0;
        const add = (x: number, y: number, w: number, h: number) =>
          result.push({
            key: `${line.key}-${result.length}`,
            x,
            y,
            w,
            h,
            color: line.color,
            glow: line.key === "accepted",
          });
        const x = (i: number) => (i / Math.max(1, data.length - 1)) * width;
        const y = (point: SemesterPoint) =>
          height - ((point[line.key] ?? 0) / max) * height;
        for (let i = 1; i <= data.length; i++) {
          if (data[start]?.[line.key] == null) break;
          if (
            i === data.length ||
            data[i][line.key] == null ||
            data[i][line.key] !== data[start][line.key]
          ) {
            const end =
              i === data.length || data[i]?.[line.key] == null ? i - 1 : i;
            add(x(start), y(data[start]), Math.max(2, x(end) - x(start)), 2);
            if (i === data.length || data[i][line.key] == null) break;
            add(
              x(i),
              Math.min(y(data[i]), y(data[start])),
              2,
              Math.max(2, Math.abs(y(data[i]) - y(data[start]))),
            );
            start = i;
          }
        }
        return result;
      }),
    [data, width, max],
  );
  return (
    <View style={s.card}>
      <Text style={s.heading}>The semester, at a glance</Text>
      <Text style={s.muted}>{settings.name} · cumulative totals</Text>
      <View style={s.row}>
        {lines.map((line) => (
          <View key={line.key} style={s.row}>
            <View
              style={{ width: 20, height: 3, backgroundColor: line.color }}
            />
            <Text style={s.muted}>{line.label}</Text>
          </View>
        ))}
      </View>
      <View
        style={{
          paddingLeft: 36,
          paddingRight: 10,
          paddingTop: 20,
          paddingBottom: 28,
        }}
      >
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={{ height }}
          accessibilityLabel="Cumulative internship progress chart"
          accessibilityRole="image"
        >
          {[0, 1, 2, 3, 4].map((tick) => (
            <View
              key={tick}
              style={{
                position: "absolute",
                top: (height * tick) / 4,
                width: "100%",
                borderTopWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={[s.muted, { position: "absolute", left: -34, top: -10 }]}
              >
                {Math.round(max * (1 - tick / 4))}
              </Text>
            </View>
          ))}
          {segments.map((segment) => (
            <React.Fragment key={segment.key}>
              {segment.glow && (
                <View
                  style={{
                    position: "absolute",
                    left: segment.x - 2,
                    top: segment.y - 2,
                    width: segment.w + 4,
                    height: segment.h + 4,
                    backgroundColor: segment.color,
                    opacity: 0.14,
                    borderRadius: 3,
                  }}
                />
              )}
              <View
                style={{
                  position: "absolute",
                  left: segment.x,
                  top: segment.y,
                  width: segment.w,
                  height: segment.h,
                  backgroundColor: segment.color,
                }}
              />
            </React.Fragment>
          ))}
          {[0, 1, 2, 3, 4].map((index) => {
            const point = data[Math.round(((data.length - 1) * index) / 4)];
            return (
              <Text
                key={index}
                style={[
                  s.muted,
                  {
                    position: "absolute",
                    top: height + 8,
                    left: (index / 4) * Math.max(0, width - 45),
                    fontSize: 10,
                  },
                ]}
              >
                {point?.date.slice(5)}
              </Text>
            );
          })}
        </View>
      </View>
      <Text style={s.text}>
        {sentThisSemester} / {settings.goal} applications sent this semester
      </Text>
      <View
        style={{ height: 5, backgroundColor: colors.border, borderRadius: 4 }}
      >
        <View
          style={{
            height: 5,
            width: `${Math.min(100, (sentThisSemester / Math.max(1, settings.goal)) * 100)}%`,
            backgroundColor: colors.purple,
            borderRadius: 4,
          }}
        />
      </View>
      <Text style={s.muted}>
        Earlier records count in the opening balance. Future days stay blank.
        Open/closed and outcomes are always changed manually.
      </Text>
    </View>
  );
}
