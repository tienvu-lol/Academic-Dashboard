import {BookOpen, CalendarDays, Link2, ListTodo, SlidersHorizontal} from "lucide-react";
import {Modal, Toggle} from "@/components";
import {DEFAULT_PREFS, PREF_KEY, type Preferences} from "@/dashboard";

export function SettingsPanel({
  preferences,
  onChange,
  onReset,
  onClose,
}: {
  preferences: Preferences;
  onChange: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const sources = [
    {key: "showAssignments" as const, label: "Assignments", detail: "University/Assignments", icon: <BookOpen className="size-4 text-pink" />},
    {key: "showTodos" as const, label: "To-Dos", detail: "University/To-Dos", icon: <ListTodo className="size-4 text-aquamarine" />},
    {key: "showCalendar" as const, label: "Google Calendar", detail: "Synced events shown inside the calendar", icon: <CalendarDays className="size-4 text-blue" />},
  ];

  return (
    <Modal title="Dashboard settings" onClose={onClose}>
      <div className="space-y-6">
        <div>
          <div className="mb-3 flex items-center gap-2"><Link2 className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Data sources & integrations</h3></div>
          <div className="divide-y rounded-lg border">
            {sources.map((source) => (
              <div key={source.key} className="flex items-center gap-3 p-3">
                <span className="rounded-md bg-muted p-2">{source.icon}</span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{source.label}</p><p className="truncate text-xs text-muted-foreground">{source.detail}</p></div>
                <Toggle checked={preferences[source.key]} onChange={() => onChange(source.key, !preferences[source.key])} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Connect another service in Fibery, then its databases can be added here as another source.</p>
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2"><SlidersHorizontal className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold">View preferences</h3></div>
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Compact rows</p><p className="text-xs text-muted-foreground">Fit more work on screen</p></div><Toggle checked={preferences.compact} onChange={() => onChange("compact", !preferences.compact)} /></div>
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Week starts Monday</p><p className="text-xs text-muted-foreground">Change calendar alignment</p></div><Toggle checked={preferences.mondayFirst} onChange={() => onChange("mondayFirst", !preferences.mondayFirst)} /></div>
          </div>
        </div>
        <button type="button" onClick={() => {localStorage.removeItem(PREF_KEY); onReset();}} className="w-full rounded-md border px-4 py-2 text-sm hover:bg-accent">Reset dashboard preferences</button>
      </div>
    </Modal>
  );
}

export {DEFAULT_PREFS};
