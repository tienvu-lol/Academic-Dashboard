import {useMemo} from "react";
import {CalendarRange, TrendingUp} from "lucide-react";
import {CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {semesterSeries, todayLocal, type Internship, type SemesterSettings} from "@/internships/model";

const series = [
  {key: "opportunities", label: "Total opportunities", color: "#a8a29e"},
  {key: "sent", label: "Applications sent", color: "#c4b5fd"},
  {key: "accepted", label: "Accepted", color: "#a3e635"},
  {key: "rejected", label: "Rejected", color: "#f87171"},
];
function displayDate(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {month: "short", day: "numeric"}); }
export function SemesterChart({items, settings, onCustomize}: {items: Internship[]; settings: SemesterSettings; onCustomize: () => void}) {
  const today = todayLocal();
  const data = useMemo(() => semesterSeries(items, settings, today), [items, settings, today]);
  const sentThisSemester = useMemo(() => items.filter(item => item.appliedDate >= settings.start && item.appliedDate <= settings.end && item.appliedDate <= today).length, [items, settings, today]);
  const latest = [...data].reverse().find(point => point.sent !== null);
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6" aria-labelledby="semester-chart-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><span className="rounded-xl bg-violet-400/10 p-2.5 text-violet-300"><TrendingUp className="size-5" /></span><div><h2 id="semester-chart-title" className="font-semibold">The semester, at a glance</h2><p className="mt-1 text-xs text-muted-foreground">Your recruiting progress · cumulative totals</p></div></div>
        <button type="button" onClick={onCustomize} className="inline-flex items-center gap-2 rounded-lg border bg-background/50 px-3 py-2 text-xs text-muted-foreground hover:bg-accent"><CalendarRange className="size-4" />{settings.name}</button>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">{series.map(line => <span key={line.key} className="inline-flex items-center gap-2"><span className="h-0.5 w-5 rounded-full" style={{backgroundColor: line.color, boxShadow: line.key === "accepted" ? "0 0 8px #a3e635aa" : undefined}} />{line.label}</span>)}</div>
      <div className="mt-5 h-[300px] w-full min-w-0 sm:h-[340px]" role="img" aria-label={`Cumulative internship chart from ${settings.start} to ${settings.end}. ${latest ? `${latest.opportunities} opportunities, ${latest.sent} applications sent, ${latest.accepted} accepted, ${latest.rejected} rejected.` : "No recorded days in this future semester yet."}`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data} margin={{top: 12, right: 15, bottom: 4, left: -18}} accessibilityLayer>
            <defs><filter id="accepted-line-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis dataKey="date" tickFormatter={displayDate} minTickGap={45} tick={{fill: "var(--muted-foreground)", fontSize: 11}} axisLine={false} tickLine={false} dy={8} />
            <YAxis allowDecimals={false} domain={[0, (maximum: number) => Math.max(4, maximum)]} tick={{fill: "var(--muted-foreground)", fontSize: 11}} axisLine={false} tickLine={false} />
            <Tooltip labelFormatter={label => displayDate(String(label))} contentStyle={{background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--foreground)"}} labelStyle={{color: "var(--foreground)", marginBottom: 8}} cursor={{stroke: "var(--muted-foreground)", strokeDasharray: "4 4"}} />
            {today >= settings.start && today <= settings.end && <ReferenceLine x={today} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{value: "Today", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11}} />}
            {series.map(line => <Line key={line.key} dataKey={line.key} name={line.label} type="stepAfter" stroke={line.color} strokeWidth={line.key === "accepted" ? 2.5 : 2} filter={line.key === "accepted" ? "url(#accepted-line-glow)" : undefined} dot={false} activeDot={{r: 4, stroke: "var(--background)", strokeWidth: 2}} isAnimationActive={false} connectNulls={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!items.length && <p className="mt-2 text-center text-sm text-muted-foreground">Import your opportunities or add an internship to start your chart.</p>}
      <div className="mt-5 flex flex-col justify-between gap-4 border-t pt-4 sm:flex-row sm:items-center">
        <p className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground">{displayDate(settings.start)} – {displayDate(settings.end)} · Earlier records count in the opening balance. Opportunities use listed dates (date added when unknown). Sent and outcomes use your recorded dates. Future days stay blank. Filters below do not change this chart.</p>
        <div className="min-w-40 shrink-0"><div className="mb-2 flex justify-between gap-4 text-xs"><span className="text-muted-foreground">Semester sending goal</span><span className="font-medium text-violet-200">{sentThisSemester} / {settings.goal}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Semester applications goal" aria-valuemin={0} aria-valuemax={settings.goal} aria-valuenow={Math.min(sentThisSemester, settings.goal)}><div className="h-full rounded-full bg-violet-300" style={{width: `${Math.min(100, sentThisSemester / settings.goal * 100)}%`}} /></div></div>
      </div>
    </section>
  );
}
