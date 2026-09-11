import {useDeferredValue, useMemo, useState} from "react";
import {ArrowDownToLine, BriefcaseBusiness, CheckCircle2, FileUp, Inbox, Plus, Search, Send, Settings2, XCircle} from "lucide-react";
import {cn} from "@/lib/cn";
import {MetricCard} from "@/dashboard-components/shared/components";
import {createInternship, needsReview, todayLocal, validateInternship, type Internship, type Outcome} from "@/internships/model";
import {INTERNSHIP_STORAGE_KEY} from "@/internships/storage";
import {downloadText, useInternships} from "@/internships/useInternships";
import {ImportDialog} from "./ImportDialog";
import {InternshipEditor} from "./InternshipEditor";
import {InternshipSettings} from "./InternshipSettings";
import {InternshipTable} from "./InternshipTable";
import {SemesterChart} from "./SemesterChart";

type View = "All opportunities" | "Open" | "Closed" | "Applied" | "Needs review";
const views: View[] = ["All opportunities", "Open", "Closed", "Applied", "Needs review"];

export default function InternshipPage() {
  const {database, error, blocked, commit, reload, notice, setNotice} = useInternships();
  const {internships: items, settings} = database;
  const [editor, setEditor] = useState<{item: Internship; isNew: boolean} | null>(null);
  const [importing, setImporting] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim().toLowerCase());
  const [view, setView] = useState<View>("All opportunities");
  const [outcome, setOutcome] = useState<"all" | Exclude<Outcome, "pending">>("all");
  const [sort, setSort] = useState("added");
  const [actionError, setActionError] = useState("");
  const today = todayLocal();

  const counts = useMemo(() => ({
    open: items.filter(item => item.availability === "open").length,
    sent: items.filter(item => item.appliedDate).length,
    accepted: items.filter(item => item.outcome === "accepted").length,
    rejected: items.filter(item => item.outcome === "rejected").length,
    ghosted: items.filter(item => item.outcome === "ghosted").length,
    review: items.filter(item => needsReview(item, today)).length,
  }), [items, today]);

  const searched = useMemo(() => items.filter(item => [item.company, item.role, item.location, item.notes, ...item.tags].join(" ").toLowerCase().includes(query)).sort((a, b) => {
    if (sort === "company") return a.company.localeCompare(b.company) || a.role.localeCompare(b.role);
    if (sort === "deadline") return (a.deadline || "9999").localeCompare(b.deadline || "9999");
    return b.createdAt.localeCompare(a.createdAt) || a.company.localeCompare(b.company);
  }), [items, query, sort]);
  const filtered = useMemo(() => searched.filter(item => view === "Open" ? item.availability === "open" : view === "Closed" ? item.availability === "closed" : view === "Applied" ? !!item.appliedDate : view === "Needs review" ? needsReview(item, today) : true), [searched, view, today]);
  const resolved = useMemo(() => searched.filter(item => item.outcome !== "pending" && (outcome === "all" || item.outcome === outcome)), [searched, outcome]);

  function saveItem(item: Internship): boolean {
    const validation = validateInternship(item);
    if (validation) {setActionError(validation); return false;}
    const next = {...item, updatedAt: today};
    const exists = items.some(row => row.id === item.id);
    const saved = commit({...database, internships: exists ? items.map(row => row.id === item.id ? next : row) : [...items, next]});
    if (saved) {setActionError(""); setNotice(exists ? "Internship updated on this device." : "Internship added on this device.");}
    return saved;
  }
  function exportBackup(recovery = false) {
    try {
      const contents = recovery ? localStorage.getItem(INTERNSHIP_STORAGE_KEY) : JSON.stringify(database, null, 2);
      if (!contents) throw new Error("No saved internship file is available.");
      downloadText(`internships-${recovery ? "recovery" : "backup"}-${today}.json`, contents);
      setNotice("Internship backup downloaded.");
    } catch (problem) {setActionError(problem instanceof Error ? problem.message : "Could not export your data.");}
  }

  return <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl highlight-aquamarine"><BriefcaseBusiness className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Your next chapter</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Internship applications</h1><p className="mt-2 text-sm text-muted-foreground">Find an opportunity. Make your move. Keep track of what comes next.</p></div></div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Customize internships" onClick={() => setCustomizing(true)} disabled={blocked} className="rounded-lg border bg-card p-2.5 text-muted-foreground hover:bg-accent disabled:opacity-40"><Settings2 className="size-4" /></button>
        <button type="button" onClick={() => exportBackup(blocked)} className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-xs hover:bg-accent"><ArrowDownToLine className="size-4" />{blocked ? "Export recovery file" : "Backup"}</button>
        <button type="button" onClick={() => setImporting(true)} disabled={blocked} className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-xs hover:bg-accent disabled:opacity-40"><FileUp className="size-4" />Import</button>
        <button type="button" onClick={() => setEditor({item: createInternship(), isNew: true})} disabled={blocked} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-medium text-primary-foreground disabled:opacity-40"><Plus className="size-4" />Add internship</button>
      </div>
    </header>
    {(error || actionError) && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{actionError || error}{blocked && <button onClick={reload} className="ml-3 underline">Retry storage</button>}</div>}
    {notice && <p role="status" className="text-xs text-aquamarine">{notice}</p>}
    <section className="grid grid-cols-2 gap-4 2xl:grid-cols-4" aria-label="Application summary">
      <MetricCard label="Opportunities" value={items.length} detail={`${counts.open} marked open`} icon={<BriefcaseBusiness />} tone="highlight-grey" />
      <MetricCard label="Applications sent" value={counts.sent} detail={`${counts.review} past deadline to review`} icon={<Send />} tone="highlight-violet" />
      <MetricCard label="Accepted" value={counts.accepted} detail="Doors opening" icon={<CheckCircle2 />} tone="highlight-green" />
      <MetricCard label="Rejected" value={counts.rejected} detail={`${counts.ghosted} marked ghosted`} icon={<XCircle />} tone="highlight-red" />
    </section>
    <SemesterChart items={items} settings={settings} onCustomize={() => setCustomizing(true)} />
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Your opportunities</h2><p className="mt-1 text-xs text-muted-foreground">Availability and outcomes are always set by you.</p></div><a href="https://github.com/SimplifyJobs/Summer2027-Internships" target="_blank" rel="noreferrer" className="text-xs text-aquamarine hover:underline">Simplify · Summer 2027 ↗</a></div>
        <div className="flex flex-col gap-3 sm:flex-row"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-3"><Search className="size-4 text-muted-foreground" /><input aria-label="Search internships" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search company, role, location, or tags…" className="min-w-0 flex-1 bg-transparent py-2.5 text-xs outline-none" /></label><select aria-label="Sort internships" value={sort} onChange={event => setSort(event.target.value)} className="rounded-lg border bg-background px-3 py-2.5 text-xs"><option value="added">Recently added</option><option value="deadline">Deadline first</option><option value="company">Company A–Z</option></select></div>
        <div className="flex flex-wrap gap-1.5">{views.map(label => <button key={label} type="button" aria-pressed={view === label} onClick={() => setView(label)} className={cn("rounded-lg px-3 py-2 text-xs", view === label ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50")}>{label}{label === "Needs review" && counts.review > 0 ? ` (${counts.review})` : ""}</button>)}</div>
      </div>
      <InternshipTable key={`${view}:${query}:${sort}`} items={filtered} compact={settings.compact} disabled={blocked} onEdit={item => setEditor({item, isNew: false})} onUpdate={saveItem} />
      {!items.length && <div className="border-t px-5 py-6 text-center"><p className="text-sm text-muted-foreground">Start with the Simplify README or an opportunity of your own.</p><button type="button" onClick={() => setImporting(true)} disabled={blocked} className="mt-3 inline-flex items-center gap-2 text-sm text-aquamarine disabled:opacity-40"><FileUp className="size-4" />Import opportunities</button></div>}
    </section>
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5"><div className="flex items-center gap-3"><span className="rounded-lg highlight-violet p-2"><Inbox className="size-4" /></span><div><h2 className="font-semibold">Outcomes & follow-through</h2><p className="mt-1 text-xs text-muted-foreground">Record accepted, rejected, or ghosted when you have an update.</p></div></div><select aria-label="Filter outcomes" value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)} className="rounded-lg border bg-background px-3 py-2 text-xs"><option value="all">All outcomes</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="ghosted">Ghosted</option></select></div>
      <InternshipTable key={`outcomes:${outcome}:${query}:${sort}`} items={resolved} compact={settings.compact} disabled={blocked} onEdit={item => setEditor({item, isNew: false})} onUpdate={saveItem} />
      <p className="border-t px-5 py-3 text-[11px] leading-5 text-muted-foreground">Past-deadline applications awaiting a response appear under “Needs review.” They stay pending until you change the outcome. Responses can also be recorded before a deadline.</p>
    </section>
    {editor && <InternshipEditor key={editor.item.id} {...editor} onSave={saveItem} onDelete={id => {const saved = commit({...database, internships: items.filter(item => item.id !== id)}); if (saved) setNotice("Internship deleted from this device."); return saved;}} onClose={() => setEditor(null)} />}
    {importing && <ImportDialog existing={items} onImport={(next, added) => {const saved = commit({...database, internships: next}); if (saved) setNotice(`${added} opportunities imported. Existing records kept unchanged.`); return saved;}} onClose={() => setImporting(false)} />}
    {customizing && <InternshipSettings settings={settings} onSave={next => commit({...database, settings: next})} onClose={() => setCustomizing(false)} />}
  </main>;
}
