import {useMemo, useState} from "react";
import {ExternalLink, FileUp, Upload} from "lucide-react";
import {Modal} from "@/dashboard-components/shared/components";
import {mergeInternships, todayLocal, type Availability, type Internship} from "@/internships/model";
import {parseInternshipImport, SIMPLIFY_SOURCE, type ImportPreview} from "@/internships/importing";

const fieldClass = "mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary";
export function ImportDialog({existing, onImport, onClose}: {existing: Internship[]; onImport: (items: Internship[], added: number) => boolean; onClose: () => void}) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [sourceName, setSourceName] = useState(SIMPLIFY_SOURCE);
  const [snapshotDate, setSnapshotDate] = useState(todayLocal());
  const [availability, setAvailability] = useState<Availability>("open");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const merged = useMemo(() => preview ? mergeInternships(existing, preview.items) : null, [existing, preview]);
  function resetPreview() { setPreview(null); setError(""); }
  async function readFile(file: File | undefined) {
    if (!file) return;
    resetPreview();
    if (file.size > 5_000_000) { setError("Choose a file smaller than 5 MB."); return; }
    setLoading(true);
    try { setText(await file.text()); setFileName(file.name); }
    catch { setError("This file could not be read. Try choosing it again."); }
    finally { setLoading(false); }
  }
  function inspect() {
    try { setPreview(parseInternshipImport(text, {sourceName, snapshotDate, availability})); setError(""); }
    catch (error) { setPreview(null); setError(error instanceof Error ? error.message : "Could not read the import."); }
  }
  return (
    <Modal title="Import internship opportunities" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">Download the raw README from Simplify, then choose the file or paste its contents below. CSV and JSON exports, including this tracker’s backups, also work.</p>
        <a href="https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">Open Simplify README <ExternalLink className="size-3.5" /></a>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-4"><FileUp className="size-6 shrink-0 text-primary" /><span className="min-w-0"><span className="block text-sm font-medium">Choose README, CSV, or JSON</span><span className="block truncate text-xs text-muted-foreground">{loading ? "Reading file…" : fileName || "Up to 5 MB · processed on this device"}</span></span><input type="file" accept=".md,.txt,.html,.csv,.json" className="sr-only" onChange={event => void readFile(event.target.files?.[0])} /></label>
        <label className="block text-xs font-medium">Or paste file contents<textarea rows={5} value={text} className={`${fieldClass} font-mono text-xs`} placeholder="Paste the raw README, JSON records, or CSV here…" onChange={event => { setText(event.target.value); setFileName(""); resetPreview(); }} /></label>
        <label className="block text-xs font-medium">Source label<input value={sourceName} className={fieldClass} onChange={event => { setSourceName(event.target.value); resetPreview(); }} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium">Source snapshot date<input type="date" max={todayLocal()} className={fieldClass} value={snapshotDate} onChange={event => { setSnapshotDate(event.target.value); resetPreview(); }} /><span className="mt-1 block text-[11px] text-muted-foreground">The day you downloaded the source; used for relative ages.</span></label>
          <label className="text-xs font-medium">Set new opportunities to<select className={fieldClass} value={availability} onChange={event => { setAvailability(event.target.value as Availability); resetPreview(); }}><option value="open">Open</option><option value="closed">Closed</option></select><span className="mt-1 block text-[11px] text-muted-foreground">Backup records retain their saved status.</span></label>
        </div>
        <p className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">Import only adds new records. Matches are skipped to preserve your statuses, notes, dates, and tags. Source closure indicators never change your tracker’s open/closed status. Backups merge records; semester settings remain as configured here.</p>
        {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
        {preview && merged && <div className="space-y-3 rounded-xl border p-3" aria-live="polite">
          <p className="text-sm font-semibold">{merged.added} new · {merged.duplicates + preview.duplicateCount} duplicates · {preview.skipped} skipped</p>
          <div className="max-h-48 overflow-auto"><table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="pb-2 pr-3">Company / role</th><th className="pb-2">Listed</th></tr></thead><tbody>{preview.items.slice(0, 8).map(item => <tr key={item.id} className="border-t"><td className="py-2 pr-3"><span className="block font-medium">{item.company}</span><span className="text-muted-foreground">{item.role}</span></td><td className="whitespace-nowrap py-2 text-muted-foreground">{item.listedDate || "Unknown"}</td></tr>)}</tbody></table></div>
          {preview.items.length > 8 && <p className="text-xs text-muted-foreground">Previewing 8 of {preview.items.length} records.</p>}
          {preview.warnings.length > 0 && <ul className="space-y-1 text-xs text-amber-200/85">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
        </div>}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={onClose}>Cancel</button><button type="button" disabled={loading || !text.trim()} className="rounded-lg border bg-muted px-3 py-2 text-sm disabled:opacity-40" onClick={inspect}>Preview import</button>{preview && merged && <button type="button" disabled={!merged.added} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40" onClick={() => { if (onImport(merged.items, merged.added)) onClose(); else setError("Could not save this import. Check available browser storage."); }}><Upload className="size-4" />Import {merged.added} new</button>}</div>
      </div>
    </Modal>
  );
}
