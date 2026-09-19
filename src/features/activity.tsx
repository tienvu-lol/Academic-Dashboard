import { useState } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { taskHistory, timelineFor } from '../data/planning';
import { todayLocal, semesterSeries } from '../internships/model';
import type { Workspace } from '../platform/workspace';

export function InternshipAnalytics({ workspace }: { workspace: Workspace }) {
  const [range, setRange] = useState(90);
  const today = new Date(), start = new Date(today); start.setDate(start.getDate() - range + 1);
  const data = semesterSeries(workspace.internships.internships, { ...workspace.internships.settings, start: todayLocal(start), end: todayLocal(today) });
  const config = { sent: { label: 'Applications', color: '#5D9DFC' }, accepted: { label: 'Offers', color: '#5c946e' }, rejected: { label: 'Rejected', color: '#FF4444' } };
  return <Card className="panel internship-timeline-panel"><CardHeader className="compact-card-header"><div><CardTitle>Application outcomes</CardTitle><CardDescription>Cumulative applications, offers, and rejections by their recorded dates.</CardDescription></div><div className="toolbar-actions">{[30, 90, 365].map(days => <Button key={days} size="sm" variant={range === days ? 'secondary' : 'ghost'} aria-pressed={range === days} onClick={() => setRange(days)}>{days === 365 ? '1 year' : days + ' days'}</Button>)}</div></CardHeader><CardContent>
    <ChartContainer config={config} className="timeline-chart"><LineChart accessibilityLayer data={data} margin={{ top: 8, right: 14, left: -15, bottom: 0 }}><CartesianGrid vertical={false} stroke="#292929" /><XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={36} tickFormatter={d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} /><YAxis allowDecimals={false} domain={[0, Math.max(1, ...data.map(d => Math.max(d.sent ?? 0, d.accepted ?? 0, d.rejected ?? 0)))]} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} />{(['sent', 'accepted', 'rejected'] as const).map(key => <Line key={key} name={config[key].label} type="monotone" dataKey={key} stroke={config[key].color} strokeWidth={2} strokeDasharray={key === 'rejected' ? '5 3' : undefined} dot={false} isAnimationActive={false} />)}</LineChart></ChartContainer>
    <div className="chart-legend">{Object.entries(config).map(([key, item]) => <span key={key}><i style={{ background: item.color }} />{item.label}</span>)}</div>
  </CardContent></Card>;
}

export function TaskAnalytics({ workspace }: { workspace: Workspace }) {
  const [range, setRange] = useState(90);
  const today = new Date(), start = new Date(today); start.setDate(start.getDate() - range + 1);
  const data = timelineFor(workspace, todayLocal(start), todayLocal(today));
  const history = taskHistory(workspace), unknown = history.filter(t => t.completed && !t.done).length;
  return <Card className="panel timeline-panel"><CardHeader className="compact-card-header"><div><CardTitle>Due vs. done</CardTitle><CardDescription>Cumulative tasks due and completed through each day, including earlier totals.</CardDescription></div><div className="toolbar-actions">{[30, 90, 365].map(days => <Button key={days} size="sm" variant={range === days ? 'secondary' : 'ghost'} aria-pressed={range === days} onClick={() => setRange(days)}>{days === 365 ? '1 year' : days + ' days'}</Button>)}</div></CardHeader><CardContent><ChartContainer config={{ due: { label: 'Cumulative due', color: '#5D9DFC' }, done: { label: 'Cumulative completed', color: '#5c946e' } }} className="timeline-chart"><LineChart accessibilityLayer data={data} margin={{ top: 8, right: 14, left: -15, bottom: 0 }}><CartesianGrid vertical={false} stroke="#292929" /><XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={36} tickFormatter={d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} /><YAxis allowDecimals={false} domain={[0, Math.max(1, ...data.map(d => Math.max(d.due, d.done)))]} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Line type="monotone" dataKey="due" stroke="var(--color-due)" strokeWidth={2} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="done" stroke="var(--color-done)" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ChartContainer><div className="chart-legend"><span><i style={{ background: '#5D9DFC' }} />Cumulative due</span><span><i style={{ background: '#5c946e' }} />Cumulative completed</span>{unknown > 0 && <small>{unknown} older completed tasks have no completion date and are excluded from dated activity.</small>}</div></CardContent></Card>;
}
