import { useState } from 'react';
import { ArrowDown, ArrowUp, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { settingsFor, coursesFor, type OrderRule } from '../data/planning';
import type { Workspace } from '../platform/workspace';
import type { Change } from './forms';

const labels: Record<OrderRule, string> = { keywords: 'Keyword matches', priority: 'Assignment / To-Do priority', due: 'Earliest due date', course: 'Preferred course order' };
function move<T>(rows: T[], index: number, delta: number): T[] { const next = [...rows]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; }
export function Settings({ workspace, change }: { workspace: Workspace; change: Change }) {
  const [settings, setSettings] = useState(() => settingsFor(workspace));
  const [keywords, setKeywords] = useState(settings.keywords.join(', '));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const courses = coursesFor(workspace);
  const courseOrder = [...settings.courseOrder.filter(id => courses.some(c => c['fibery/id'] === id)), ...courses.map(c => c['fibery/id']).filter(id => !settings.courseOrder.includes(id))];
  function arrows(index: number, length: number, update: (delta: number) => void, name: string) { return <><Button variant="ghost" size="icon-sm" disabled={index === 0} aria-label={'Move ' + name + ' up'} onClick={() => { update(-1); setSaved(false); }}><ArrowUp /></Button><Button variant="ghost" size="icon-sm" disabled={index === length - 1} aria-label={'Move ' + name + ' down'} onClick={() => { update(1); setSaved(false); }}><ArrowDown /></Button></>; }
  return <section className="panel settings-panel"><div className="section-heading"><div><div className="eyebrow">YOUR WORKFLOW, YOUR RULES</div><h2><SlidersHorizontal size={19} />Calendar priorities</h2></div></div><p className="muted">Rules are applied from top to bottom. The first-ranked task in each day gets a colored outline.</p>
    <div className="priority-order">{settings.order.map((rule, i) => <div className={'order-row ' + (i === 0 ? 'first-rule' : '')} key={rule}><span className="order-number">{i + 1}</span><span>{labels[rule]}</span>{arrows(i, settings.order.length, delta => setSettings({ ...settings, order: move(settings.order, i, delta) }), labels[rule])}</div>)}</div>
    <label className="field"><span>Keywords to emphasize</span><Input value={keywords} onChange={e => { setKeywords(e.target.value); setSaved(false); }} placeholder="Test, Exam, Quiz" /><small className="muted">Separate keywords with commas. Matches are bold in your list and calendar.</small></label>
    <h3>Preferred course order</h3><p className="muted">Used when the course rule decides the order.</p><div className="priority-order">{courseOrder.length ? courseOrder.map((id, i) => <div key={id} className="order-row"><span className="order-number">{i + 1}</span><span>{courses.find(c => c['fibery/id'] === id)?.['University/Name']}</span>{arrows(i, courseOrder.length, delta => setSettings({ ...settings, courseOrder: move(courseOrder, i, delta) }), 'course')}</div>) : <p className="empty-small">Add courses on your dashboard to arrange them here.</p>}</div>
    <div className="form-actions"><span role="status" className="text-green">{saved ? 'Preferences saved' : ''}</span><Button disabled={busy} onClick={async () => { setBusy(true); const ok = await change(draft => { draft.dashboardSettings = { ...settings, sidebarSlim: settingsFor(draft).sidebarSlim, keywords: keywords.split(',').map(x => x.trim()).filter(Boolean), courseOrder }; }); setBusy(false); setSaved(ok); }}>Save preferences</Button></div>
  </section>;
}
