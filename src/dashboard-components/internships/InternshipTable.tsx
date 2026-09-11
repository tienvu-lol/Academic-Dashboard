import {ChevronLeft, ChevronRight, ExternalLink, Pencil, Send} from "lucide-react";
import {useState} from "react";
import {cn} from "@/lib/cn";
import {needsReview, safeUrl, type Internship} from "@/internships/model";

const outcomeTone = {pending: "highlight-grey", accepted: "highlight-green", rejected: "highlight-red", ghosted: "highlight-violet"};
const outcomeLabel = {pending: "Awaiting response", accepted: "Accepted", rejected: "Rejected", ghosted: "Ghosted"};

export function InternshipTable({items, compact, disabled, onEdit, onUpdate}: {
  items: Internship[];
  compact: boolean;
  disabled: boolean;
  onEdit: (item: Internship) => void;
  onUpdate: (item: Internship) => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-xs">
        <thead className="border-y bg-background/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>{["Company / role", "Availability", "Deadline", "Application", "Outcome", ""].map((label, i) => <th key={i} scope="col" className="px-4 py-3 font-medium">{label || <span className="sr-only">Actions</span>}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {visible.map(item => <tr key={item.id} className="group hover:bg-muted/20">
            <td className={cn("max-w-80 px-4", compact ? "py-2" : "py-4")}>
              <button type="button" onClick={() => onEdit(item)} className="max-w-full text-left hover:text-aquamarine"><span className="block font-semibold text-sm">{item.company}</span><span className="mt-1 block break-words text-muted-foreground">{item.role}</span></button>
              {item.location && <p className="mt-1 text-[11px] text-muted-foreground">{item.location}</p>}
              {item.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{item.tags.slice(0, 3).map(tag => <span key={tag} className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>)}{item.tags.length > 3 && <span className="text-muted-foreground">+{item.tags.length - 3}</span>}</div>}
            </td>
            <td className="px-4 py-3"><select aria-label={`Availability for ${item.company} ${item.role}`} value={item.availability} disabled={disabled} onChange={event => onUpdate({...item, availability: event.target.value as Internship["availability"]})} className={cn("rounded-lg border px-2 py-1.5 text-xs", item.availability === "open" ? "highlight-aquamarine" : "highlight-grey")}><option value="open">Open</option><option value="closed">Closed</option></select></td>
            <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{item.deadline || "Not provided"}{needsReview(item) && <span className="mt-1.5 block text-[10px] text-yellow">Review response</span>}</td>
            <td className="whitespace-nowrap px-4 py-3">{item.appliedDate ? <><span className="text-violet">Sent</span><span className="mt-1 block text-[11px] text-muted-foreground">{item.appliedDate}</span></> : <button type="button" disabled={disabled} onClick={() => onEdit(item)} className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-muted-foreground hover:bg-accent"><Send className="size-3" />Record application</button>}</td>
            <td className="px-4 py-3">{item.appliedDate ? <button type="button" onClick={() => onEdit(item)} className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium", outcomeTone[item.outcome])}>{outcomeLabel[item.outcome]}</button> : <span className="text-muted-foreground">Not applied</span>}{item.outcomeDate && <span className="mt-1 block text-[11px] text-muted-foreground">{item.outcomeDate}</span>}</td>
            <td className="px-4 py-3"><div className="flex gap-1">{safeUrl(item.url) && <a href={safeUrl(item.url)} target="_blank" rel="noreferrer" aria-label={`Open application link for ${item.company}`} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><ExternalLink className="size-4" /></a>}<button type="button" onClick={() => onEdit(item)} aria-label={`Edit internship at ${item.company}`} className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><Pencil className="size-4" /></button></div></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {!items.length && <div className="px-5 py-10 text-center text-sm text-muted-foreground">No internships in this view yet.</div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
      <span>{items.length ? currentPage * pageSize + 1 : 0}–{Math.min((currentPage + 1) * pageSize, items.length)} of {items.length}</span>
      <div className="flex items-center gap-3"><button aria-label="Previous table page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-md border p-1.5 disabled:opacity-30"><ChevronLeft className="size-3.5" /></button><span>Page {currentPage + 1} of {pageCount}</span><button aria-label="Next table page" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-md border p-1.5 disabled:opacity-30"><ChevronRight className="size-3.5" /></button></div>
    </div>
  </>;
}
