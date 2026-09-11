import {useState, type FormEvent} from "react";
import {Save, Trash2} from "lucide-react";
import {Modal} from "@/dashboard-components/shared/components";
import {todayLocal, validateInternship, type Internship, type Outcome} from "@/internships/model";

const fieldClass = "mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
export function InternshipEditor({item, isNew, onSave, onDelete, onClose}: {
  item: Internship; isNew: boolean; onSave: (item: Internship) => boolean; onDelete: (id: string) => boolean; onClose: () => void;
}) {
  const [draft, setDraft] = useState(item);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = <K extends keyof Internship>(key: K, value: Internship[K]) => setDraft(current => ({...current, [key]: value}));
  function save(event: FormEvent) {
    event.preventDefault();
    const next: Internship = {...draft, company: draft.company.trim(), role: draft.role.trim(), url: draft.url.trim(), tags: [...new Set(tags.split(",").map(tag => tag.trim()).filter(Boolean))], updatedAt: todayLocal()};
    if (next.outcome === "pending") next.outcomeDate = "";
    const validation = validateInternship(next);
    if (validation) { setError(validation); return; }
    if (onSave(next)) onClose(); else setError("This change could not be saved. Check the storage message on the page.");
  }
  return (
    <Modal title={isNew ? "Add an internship" : "Edit internship"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium">Company <span className="text-muted-foreground">*</span><input autoFocus required maxLength={200} className={fieldClass} value={draft.company} onChange={event => update("company", event.target.value)} /></label>
          <label className="text-xs font-medium">Role <span className="text-muted-foreground">*</span><input required maxLength={500} className={fieldClass} value={draft.role} onChange={event => update("role", event.target.value)} /></label>
          <label className="text-xs font-medium">Location<input className={fieldClass} placeholder="Blacksburg, VA · Remote" value={draft.location} onChange={event => update("location", event.target.value)} /></label>
          <label className="text-xs font-medium">Availability<select className={fieldClass} value={draft.availability} onChange={event => update("availability", event.target.value as Internship["availability"])}><option value="open">Open</option><option value="closed">Closed</option></select></label>
        </div>
        <p className="text-xs text-muted-foreground">Open and closed are controlled by you. Passing a deadline never changes availability or marks an application ghosted.</p>
        <label className="block text-xs font-medium">Application link<input type="url" className={fieldClass} placeholder="https://…" value={draft.url} onChange={event => update("url", event.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium">Listed date<input type="date" className={fieldClass} value={draft.listedDate} onChange={event => update("listedDate", event.target.value)} /><span className="mt-1 block text-[11px] text-muted-foreground">Leave blank if unknown; chart uses date added.</span></label>
          <label className="text-xs font-medium">Application deadline<input type="date" className={fieldClass} value={draft.deadline} onChange={event => update("deadline", event.target.value)} /></label>
        </div>
        <div className="rounded-xl border bg-muted/35 p-3">
          <h3 className="text-sm font-semibold">Your application</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium">Date sent<input type="date" max={todayLocal()} className={fieldClass} value={draft.appliedDate} onChange={event => update("appliedDate", event.target.value)} /><span className="mt-1 block text-[11px] text-muted-foreground">Leave blank until you apply.</span></label>
            <label className="text-xs font-medium">Outcome<select className={fieldClass} value={draft.outcome} onChange={event => update("outcome", event.target.value as Outcome)}><option value="pending">Awaiting response</option><option value="ghosted">Ghosted</option><option value="rejected">Rejected</option><option value="accepted">Accepted</option></select></label>
            {draft.outcome !== "pending" && <label className="text-xs font-medium sm:col-span-2">Outcome date<input type="date" required max={todayLocal()} className={fieldClass} value={draft.outcomeDate} onChange={event => update("outcomeDate", event.target.value)} /></label>}
          </div>
        </div>
        <label className="block text-xs font-medium">Tags<input className={fieldClass} placeholder="Robotics, Dream role, Referral" value={tags} onChange={event => setTags(event.target.value)} /><span className="mt-1 block text-[11px] text-muted-foreground">Separate tags with commas. Search includes tags and notes.</span></label>
        <label className="block text-xs font-medium">Notes<textarea rows={3} className={fieldClass} placeholder="Contacts, next steps, interview notes…" value={draft.notes} onChange={event => update("notes", event.target.value)} /></label>
        <p className="break-words text-[11px] text-muted-foreground">Source: {draft.sourceName} · Added {draft.createdAt.slice(0, 10)}{draft.sourceAvailability ? ` · Source reported: ${draft.sourceAvailability}` : ""}</p>
        {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
        {confirmDelete ? <div className="rounded-lg border border-red-400/30 p-3"><p className="text-sm">Delete this internship and its application history?</p><div className="mt-3 flex gap-2"><button type="button" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300" onClick={() => { if (onDelete(draft.id)) onClose(); else setError("Could not save the deletion. Please try again."); }}>Delete internship</button><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setConfirmDelete(false)}>Keep it</button></div></div> : <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div>{!isNew && <button type="button" className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-red-500/10 hover:text-red-300" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />Delete</button>}</div><div className="flex gap-2"><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={onClose}>Cancel</button><button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Save className="size-4" />Save internship</button></div></div>}
      </form>
    </Modal>
  );
}
