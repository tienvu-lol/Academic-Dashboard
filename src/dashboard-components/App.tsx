import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { initialize, exportWorkspace, storagePath, useWorkspace } from "../platform/workspace";
import { Academics } from "./Academics";
import { Internships } from "./Internships";
import { Imports } from "./Imports";
import { Button } from "./ui";
import { colors, mergeStyles, styles } from "./theme";

type Page = "academics" | "internships" | "imports";

function Dashboard() {
  const [page, setPage] = useState<Page>("academics");
  const state = useWorkspace();
  useEffect(() => { void initialize(); }, []);
  return (
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <text style={{ ...styles.eyebrow, color: colors.mint }}>PERSONAL WORKSPACE</text>
        <text style={{ ...styles.heading, marginBottom: 24 }}>Academic Dashboard</text>
        {([
          ["academics", "01   Academics"],
          ["internships", "02   Internships"],
          ["imports", "03   Import & backup"],
        ] as const).map(([id, label]) => (
          <div
            key={id}
            role="tab"
            aria-selected={page === id}
            aria-label={label}
            tabIndex={0}
            onClick={() => setPage(id)}
            style={mergeStyles(styles.button, { alignItems: "flex-start" }, page === id && styles.active)}
          >
            <text style={{ ...styles.text, color: page === id ? colors.mint : colors.text }}>{label}</text>
          </div>
        ))}
        <div style={{ flexGrow: 1 }} />
        <text style={styles.muted}>GPUix native renderer</text>
        <text style={styles.muted}>Bun SQL · SQLite</text>
        <text style={{ ...styles.muted, fontSize: 10 }}>{storagePath()}</text>
      </div>
      <div style={styles.content}>
        <div style={{ ...styles.spread, paddingLeft: 28, paddingRight: 28, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.border }}>
          <text style={styles.muted}>WORKSPACE / {page.toUpperCase()}</text>
          <text style={{ ...styles.muted, color: colors.mint }}>{state.busy ? "Saving…" : state.notice || "Local SQL workspace"}</text>
        </div>
        {state.error ? (
          <div style={{ padding: 14, backgroundColor: "#492b29" }}>
            <text style={styles.text}>{state.error}</text>
          </div>
        ) : null}
        {!state.ready ? (
          <div style={styles.page}>
            <text style={styles.heading}>{state.busy ? "Opening Bun SQL workspace…" : "Your workspace could not be opened"}</text>
            {!state.busy ? <Button onPress={() => void initialize()}>Try again</Button> : null}
          </div>
        ) : page === "academics" ? (
          <Academics />
        ) : page === "internships" ? (
          <Internships onImport={() => setPage("imports")} />
        ) : (
          <Imports />
        )}
      </div>
    </div>
  );
}

export default class App extends Component<object, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info.componentStack); }
  render(): ReactNode {
    if (!this.state.error) return <Dashboard />;
    return (
      <div style={{ ...styles.app, ...styles.page, flexDirection: "column" }}>
        <text style={styles.title}>The dashboard encountered an error</text>
        <text style={styles.text}>{this.state.error}</text>
        <div style={styles.row}>
          <Button onPress={() => this.setState({ error: "" })}>Reload interface</Button>
          <Button onPress={() => void exportWorkspace()}>Export backup</Button>
        </div>
      </div>
    );
  }
}
