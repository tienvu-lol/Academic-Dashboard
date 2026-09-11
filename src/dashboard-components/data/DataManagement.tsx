import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {AlertCircle, ArrowDownToLine, Database, FileJson, FileUp, HardDrive, ShieldCheck} from "lucide-react";
import {ACADEMIC_TYPES, rawAcademicData, readAcademicData, type AcademicType} from "@/data/academic";
import {commitAcademicImport, parseAcademicImport, previewAcademicImport, type AcademicImport, type ImportPreview} from "@/data/academicImport";

function downloadFile(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], {type: "application/json"}));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const inputStyle = "w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export default function DataManagement() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<AcademicType>("University/Courses");
  const [filename, setFilename] = useState("");
  const [source, setSource] = useState<AcademicImport | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const storage = useQuery({queryKey: ["academic-storage-summary"], queryFn: readAcademicData});
  const total = storage.data ? Object.values(storage.data.collections).reduce((count, rows) => count + rows.length, 0) : 0;

  async function chooseFile(file?: File) {
    if (!file) return;
    setBusy(true); setError(""); setMessage(""); setPreview(null); setSource(null); setFilename(file.name);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Choose an export smaller than 10 MB.");
      const parsed = parseAcademicImport(await file.text(), file.name, type);
      setPreview(previewAcademicImport(parsed)); setSource(parsed);
    } catch (problem) {setError(problem instanceof Error ? problem.message : String(problem));}
    finally {setBusy(false);}
  }
  async function importPreview() {
    if (!source) return;
    setBusy(true); setError("");
    try {
      const result = commitAcademicImport(source);
      setMessage(`Imported ${result.added} record${result.added === 1 ? "" : "s"}. ${result.skipped} existing or duplicate record${result.skipped === 1 ? "" : "s"} kept unchanged.`);
      setPreview(null); setSource(null);
      await queryClient.invalidateQueries();
    } catch (problem) {setError(problem instanceof Error ? problem.message : String(problem));}
    finally {setBusy(false);}
  }
  function exportBackup(raw = false) {
    try {
      const content = raw ? rawAcademicData() : JSON.stringify(readAcademicData(), null, 2);
      if (!content) throw new Error("There is no saved academic data to export yet.");
      downloadFile(`academic-${raw ? "raw-recovery-" : "backup-"}${new Date().toISOString().slice(0, 10)}.json`, content);
      setError(""); setMessage("Academic backup downloaded. Internship backups are available on the Internships page.");
    } catch (problem) {setError(problem instanceof Error ? problem.message : String(problem));}
  }

  return <main className="mx-auto max-w-[1600px] space-y-7 p-4 sm:p-6 lg:p-8">
    <header className="flex items-start gap-4">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl highlight-aquamarine"><Database className="size-6" /></span>
      <div><p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Your workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Data & imports</h1><p className="mt-2 text-sm text-muted-foreground">Bring your Fibery records home and keep a copy of your work.</p></div>
    </header>

    {error || storage.error ? <div role="alert" className="flex gap-3 whitespace-pre-line rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"><AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /><div>{error || (storage.error instanceof Error ? storage.error.message : String(storage.error))}</div></div> : null}
    {message ? <div role="status" className="rounded-xl border p-4 text-sm highlight-green">{message}</div> : null}

    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-3"><FileUp className="size-5 text-primary" /><h2 className="text-lg font-semibold">Import from Fibery</h2></div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose one collection and upload its CSV or JSON export. Import courses first to connect assignments by course ID or name. Academic backup files include all collections.</p>
        <div className="mt-5 space-y-4">
          <label className="block space-y-2 text-sm font-medium"><span>Collection</span><select value={type} disabled={busy} className={inputStyle} onChange={(event) => {setType(event.target.value as AcademicType); setSource(null); setPreview(null); setFilename(""); setError("");}}>{ACADEMIC_TYPES.map((value) => <option key={value} value={value}>{value.split("/")[1]}</option>)}</select></label>
          <label className="block cursor-pointer rounded-xl border border-dashed p-6 text-center transition hover:bg-muted/50">
            <FileJson className="mx-auto mb-3 size-8 text-muted-foreground" /><span className="block text-sm font-medium">Choose a CSV or JSON file</span><span className="mt-1 block text-xs text-muted-foreground">{busy ? "Reading export…" : filename || "Files are processed on this device · up to 10 MB"}</span>
            <input key={type} type="file" accept=".csv,.json,text/csv,application/json" aria-label="Choose Fibery export or academic backup" disabled={busy} className="mt-4 max-w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground" onChange={(event) => {void chooseFile(event.target.files?.[0]); event.target.value = "";}} />
          </label>
        </div>
        {preview ? <div className="mt-5 space-y-4 rounded-xl border bg-background p-4">
          <div><h3 className="font-semibold">Review import{source?.kind === "backup" ? " · academic backup" : ""}</h3><p className="mt-1 text-sm text-muted-foreground">{preview.added} new records · {preview.skipped} duplicates skipped. Existing records stay unchanged.</p></div>
          {preview.names.length ? <ul className="max-h-52 divide-y overflow-auto text-sm">{preview.names.slice(0, 50).map((item, index) => <li key={index} className="flex justify-between gap-3 py-2"><span className="break-words">{item.name}</span><span className="shrink-0 text-xs text-muted-foreground">{item.type}</span></li>)}{preview.names.length > 50 ? <li className="pt-2 text-muted-foreground">And {preview.names.length - 50} more records.</li> : null}</ul> : null}
          {preview.warnings.length ? <div className="space-y-2 rounded-lg p-3 text-xs highlight-yellow">{preview.warnings.slice(0, 8).map((warning) => <p key={warning}>{warning}</p>)}{preview.warnings.length > 8 ? <p>{preview.warnings.length - 8} more warnings of the same kind.</p> : null}</div> : null}
          <button disabled={busy || preview.added === 0} onClick={() => void importPreview()} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"><FileUp className="size-4" />{busy ? "Importing…" : `Import ${preview.added} records`}</button>
        </div> : null}
      </section>

      <div className="space-y-5">
        <section className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-3"><HardDrive className="size-5 text-primary" /><h2 className="text-lg font-semibold">Stored on this device</h2></div>
          <p className="mt-3 text-3xl font-semibold">{total}<span className="ml-2 text-sm font-normal text-muted-foreground">academic records</span></p>
          <div className="mt-4 divide-y text-sm">{ACADEMIC_TYPES.map((collection) => <div key={collection} className="flex justify-between py-2.5"><span className="text-muted-foreground">{collection.split("/")[1]}</span><span>{storage.data?.collections[collection].length ?? "—"}</span></div>)}</div>
          <button onClick={() => exportBackup()} disabled={!!storage.error} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border bg-muted px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"><ArrowDownToLine className="size-4" />Download academic backup</button>
          {storage.error ? <button onClick={() => exportBackup(true)} className="mt-3 text-sm text-primary underline">Download raw data for recovery</button> : null}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Local browser storage belongs to this browser and site address. Keep backups before clearing site data, changing browsers, or moving devices. Restore by choosing the backup file in the importer.</p>
        </section>
        <div className="flex items-start gap-3 rounded-xl border p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><p>Imports run only when you choose a file. Google Calendar import is disabled. No Fibery credentials or live workspace connection are needed.</p></div>
      </div>
    </div>

    <section className="rounded-2xl border bg-card p-6">
      <h2 className="text-lg font-semibold">Export format guide</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">CSV needs a header row and a Name or Title column. JSON accepts an array, an <code>entities</code> or <code>data</code> array, or a collection-named array. Namespaced Fibery fields such as <code>University/Name</code> are supported. Dates use YYYY-MM-DD or ISO timestamps.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-muted-foreground"><tr><th className="pb-3 pr-6 font-medium">Collection</th><th className="pb-3 font-medium">Recognized columns beyond Name</th></tr></thead><tbody className="divide-y">
        <tr><td className="py-3 pr-6">Courses</td><td className="py-3 text-muted-foreground">Credit Hours / Credits, Academic Year / Semester / Term, Description</td></tr>
        <tr><td className="py-3 pr-6">Assignments</td><td className="py-3 text-muted-foreground">Due Date / Deadline, Course, Priority, State / Status, Description</td></tr>
        <tr><td className="py-3 pr-6">To-Dos</td><td className="py-3 text-muted-foreground">Due Date / Deadline, Category, State / Status, Description</td></tr>
        <tr><td className="py-3 pr-6">Completed Work</td><td className="py-3 text-muted-foreground">Completion Date, Original Due Date, Course, Category, Priority, Type</td></tr>
        <tr><td className="py-3 pr-6">Dashboard Notes</td><td className="py-3 text-muted-foreground">Markdown / Content / Text / Body</td></tr>
      </tbody></table></div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Records match by Fibery ID or name + date + course/term. Unknown fields are preserved for future mappings. Custom category, priority, and semester names become selectable options. Descriptions need exported Markdown or document JSON; a Fibery document secret alone does not contain the text. Files and remote attachments are not downloaded.</p>
    </section>
  </main>;
}
