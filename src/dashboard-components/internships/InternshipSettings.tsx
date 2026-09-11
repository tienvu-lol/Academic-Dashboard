import {useState, type FormEvent} from "react";
import {Modal} from "@/dashboard-components/shared/components";
import {SEMESTERS, validateSettings, type SemesterSettings} from "@/internships/model";

const fieldClass = "mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary";
export function InternshipSettings({settings, onSave, onClose}: {settings: SemesterSettings; onSave: (settings: SemesterSettings) => boolean; onClose: () => void}) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    const validation = validateSettings(draft);
    if (validation) { setError(validation); return; }
    if (onSave({...draft, name: draft.name.trim()})) onClose(); else setError("Settings could not be saved locally. Check available browser storage.");
  }
  return <Modal title="Customize your internship page" onClose={onClose}><form className="space-y-4" onSubmit={save}>
    <p className="text-sm text-muted-foreground">Set your semester, personal application goal, and table spacing. These preferences stay on this device.</p>
    <label className="block text-xs font-medium">Semester preset<select className={fieldClass} value={SEMESTERS.findIndex(semester => semester.start === draft.start && semester.end === draft.end)} onChange={event => { const preset = SEMESTERS[Number(event.target.value)]; if (preset) setDraft({...draft, name: preset.name, start: preset.start, end: preset.end}); }}><option value={-1}>Custom dates</option>{SEMESTERS.map((semester, index) => <option key={semester.name} value={index}>{semester.name}</option>)}</select></label>
    <label className="block text-xs font-medium">Semester name<input required maxLength={80} className={fieldClass} value={draft.name} onChange={event => setDraft({...draft, name: event.target.value})} /></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium">First day<input type="date" required className={fieldClass} value={draft.start} onChange={event => setDraft({...draft, start: event.target.value})} /></label><label className="text-xs font-medium">Last day<input type="date" required className={fieldClass} value={draft.end} onChange={event => setDraft({...draft, end: event.target.value})} /></label></div>
    <label className="block text-xs font-medium">Applications to send this semester<input type="number" min={1} max={100000} step={1} required className={fieldClass} value={draft.goal} onChange={event => setDraft({...draft, goal: Number(event.target.value)})} /></label>
    <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={draft.compact} className="size-4 accent-primary" onChange={event => setDraft({...draft, compact: event.target.checked})} /><span>Compact table rows<span className="mt-1 block text-xs text-muted-foreground">Fit more opportunities on the page.</span></span></label>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <div className="flex justify-end gap-2 border-t pt-4"><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={onClose}>Cancel</button><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save preferences</button></div>
  </form></Modal>;
}
