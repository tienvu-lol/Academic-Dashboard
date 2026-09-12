import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  initialize,
  exportWorkspace,
  useWorkspace,
} from "../platform/workspace";
import { Academics } from "./Academics";
import { Internships } from "./Internships";
import { Imports } from "./Imports";
import { Button } from "./ui";
import { colors, styles as s } from "./theme";

function Dashboard() {
  const [page, setPage] = useState("academics");
  const state = useWorkspace();
  useEffect(() => {
    void initialize();
  }, []);
  return (
    <View style={s.app}>
      <View style={s.sidebar}>
        <Text style={[s.eyebrow, { color: colors.mint }]}>
          PERSONAL WORKSPACE
        </Text>
        <Text style={[s.heading, { marginBottom: 32 }]}>
          Academic Dashboard
        </Text>
        {[
          { id: "academics", label: "01   Academics" },
          { id: "internships", label: "02   Internships" },
          { id: "imports", label: "03   Import & backup" },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            onAccessibilityTap={() => setPage(tab.id)}
            accessibilityLabel={tab.label}
            accessibilityActions={[{ name: "activate" }]}
            onAccessibilityAction={() => setPage(tab.id)}
            accessibilityState={{ selected: page === tab.id }}
            onPress={() => setPage(tab.id)}
            style={[
              s.button,
              { alignItems: "flex-start", marginBottom: 10 },
              page === tab.id && s.active,
            ]}
          >
            <Text style={[s.text, page === tab.id && { color: colors.mint }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={s.muted}>Stored locally on Windows</Text>
        <Text style={[s.muted, { marginTop: 8 }]}>
          Calendar import disabled
        </Text>
      </View>
      <View style={s.content}>
        <View
          style={[
            s.spread,
            {
              paddingHorizontal: 28,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={s.muted}>WORKSPACE / {page.toUpperCase()}</Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[s.muted, { color: colors.mint }]}
          >
            {state.busy ? "Saving…" : state.notice || "Local workspace"}
          </Text>
        </View>
        {!!state.error && (
          <View style={{ padding: 16, backgroundColor: "#492b29" }}>
            <Text selectable accessibilityLiveRegion="assertive" style={s.text}>
              {state.error}
            </Text>
          </View>
        )}
        {!state.ready ? (
          <View style={s.page}>
            {state.busy ? (
              <ActivityIndicator color={colors.mint} />
            ) : (
              <>
                <Text style={s.heading}>
                  Your workspace could not be opened
                </Text>
                <View style={s.row}>
                  <Button onPress={() => void initialize()}>Try again</Button>
                  <Button onPress={() => void exportWorkspace()}>
                    Export existing file for recovery
                  </Button>
                </View>
              </>
            )}
          </View>
        ) : page === "academics" ? (
          <Academics />
        ) : page === "internships" ? (
          <Internships onImport={() => setPage("imports")} />
        ) : (
          <Imports />
        )}
      </View>
    </View>
  );
}
export default class App extends React.Component<{}, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <View style={[s.app, s.page, { flexDirection: "column" }]}>
        <Text style={s.title}>The dashboard encountered an error</Text>
        <Text selectable style={s.text}>
          {this.state.error}
        </Text>
        <Button onPress={() => this.setState({ error: "" })}>
          Reload interface
        </Button>
        <Button onPress={() => void exportWorkspace()}>Export backup</Button>
      </View>
    ) : (
      <Dashboard />
    );
  }
}
