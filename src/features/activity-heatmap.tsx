import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { todayLocal } from '../internships/model';

export function ActivityHeatmap({ counts, title, noun, years = [] }: { counts: Record<string, number>; title: string; noun: string; years?: number[] }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selected, setSelected] = useState('');
  const available = [...new Set([new Date().getFullYear(), ...years, ...Object.keys(counts).map(d => Number(d.slice(0, 4)))])].sort((a, b) => b - a);
  const first = new Date(year, 0, 1, 12), start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  const last = new Date(year, 11, 31, 12);
  const dayCount = Math.round((last.getTime() - start.getTime()) / 86400000) + 1;
  const days = Array.from({ length: Math.ceil(dayCount / 7) * 7 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return date; });
  const maximum = Math.max(1, ...days.map(d => counts[todayLocal(d)] ?? 0));
  const total = Object.entries(counts).filter(([d]) => d.startsWith(String(year))).reduce((n, [, count]) => n + count, 0);
  return <Card className="panel activity-panel"><CardHeader className="compact-card-header"><div><CardTitle>{title}</CardTitle><CardDescription>{total} {noun} in {year} · select a day for its count</CardDescription></div><select aria-label={title + ' year'} value={year} onChange={e => { setYear(Number(e.target.value)); setSelected(''); }}>{available.map(y => <option key={y}>{y}</option>)}</select></CardHeader><CardContent className="heatmap-content"><div className="heatmap-scroll"><div className="contribution-grid" style={{ gridTemplateColumns: 'repeat(' + days.length / 7 + ', minmax(9px, 1fr))' }}>{days.map(day => {
    const key = todayLocal(day), count = counts[key] ?? 0, valid = day.getFullYear() === year;
    const level = count ? Math.max(1, Math.ceil(count / maximum * 4)) : 0;
    return <Tooltip key={key}><TooltipTrigger asChild><button type="button" className={'heat-square heat-' + level} style={{ visibility: valid ? 'visible' : 'hidden' }} disabled={!valid} aria-label={key + ': ' + count + ' ' + noun} aria-pressed={selected === key} onClick={() => setSelected(key)} /></TooltipTrigger><TooltipContent>{key}: {count} {noun}</TooltipContent></Tooltip>;
  })}</div><div className="heat-months">{Array.from({ length: 12 }, (_, i) => <span key={i}>{new Date(year, i, 1).toLocaleDateString(undefined, { month: 'short' })}</span>)}</div></div><div className="heatmap-footer"><span role="status">{selected ? selected + ': ' + (counts[selected] ?? 0) + ' ' + noun : 'Each square is one day'}</span><div>Less {[0, 1, 2, 3, 4].map(n => <i key={n} className={'heat-square heat-' + n} />)} More</div></div></CardContent></Card>;
}
