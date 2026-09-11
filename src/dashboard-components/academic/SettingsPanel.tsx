import {BookOpen, CalendarDays, CheckCircle2, GraduationCap, ListTodo, NotebookPen, SlidersHorizontal} from "lucide-react";
import {Modal, Toggle} from "@/dashboard-components/shared/components";
import {DEFAULT_PREFS, type Preferences} from "@/dashboard";

export function SettingsPanel({preferences, onChange, onReset, onClose}: {
  preferences: Preferences;
  onChange: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const sections = [
    {key: "showAssignments" as const, label: "Assignments", detail: "Include coursework in your queue", icon: BookOpen},
    {key: "showTodos" as const, label: "To-dos", detail: "Include personal tasks and plans", icon: ListTodo},
    {key: "showNotes" as const, label: "Notes", detail: "Keep a scratchpad on your dashboard", icon: NotebookPen},
    {key: "showMomentum" as const, label: "Monthly momentum", detail: "Show your completed-work chart", icon: CheckCircle2},
    {key: "showCourses" as const, label: "Degree map", detail: "Show courses and credits by term", icon: GraduationCap},
  ];
  return (
    <Modal title="Customize dashboard" onClose={onClose}>
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold">Make room for what matters</h3>
          <div className="divide-y rounded-lg border">
            {sections.map(({key, label, detail, icon: Icon}) => (
              <div key={key} className="flex items-center gap-3 p-3">
                <span className="rounded-lg bg-muted p-2 text-aquamarine"><Icon className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
                <Toggle label={`Show ${label.toLowerCase()}`} checked={preferences[key]} onChange={() => onChange(key, !preferences[key])} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2"><SlidersHorizontal className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold">View preferences</h3></div>
          <div className="space-y-4 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Compact rows</p><p className="text-xs text-muted-foreground">Fit more work on screen</p></div><Toggle label="Compact rows" checked={preferences.compact} onChange={() => onChange("compact", !preferences.compact)} /></div>
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Week starts Monday</p><p className="text-xs text-muted-foreground">Change calendar alignment</p></div><Toggle label="Week starts Monday" checked={preferences.mondayFirst} onChange={() => onChange("mondayFirst", !preferences.mondayFirst)} /></div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border bg-background p-3 text-xs text-muted-foreground"><CalendarDays className="size-4 shrink-0" /><p><span className="font-medium text-foreground">Google Calendar import is disabled.</span><br />Your workload calendar still shows local assignments and tasks.</p></div>
        <button type="button" onClick={onReset} className="w-full rounded-md border px-4 py-2 text-sm hover:bg-accent">Reset dashboard preferences</button>
      </div>
    </Modal>
  );
}

export {DEFAULT_PREFS};