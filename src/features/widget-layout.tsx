import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GripVertical, ArrowUp, ArrowDown, RotateCcw, Scaling } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dockWidget, layoutFor, resizeWidget, widgetPositions, type DockSide, type LayoutPage, type WidgetPlacement } from '../data/layout';
import { settingsFor } from '../data/planning';
import type { Workspace } from '../platform/workspace';
import type { Change } from './forms';

export interface Widget { id: string; title: string; content: ReactNode }
export function WidgetLayout({ page, workspace, change, editing, busy, widgets }: {
  page: LayoutPage; workspace: Workspace; change: Change; editing: boolean; busy: boolean; widgets: Widget[];
}) {
  const saved = layoutFor(page, settingsFor(workspace).layouts);
  const [preview, setPreview] = useState<WidgetPlacement[]>();
  const [target, setTarget] = useState<{ id: string; side: DockSide }>();
  const [announcement, setAnnouncement] = useState('');
  const source = useRef<string | undefined>(undefined);
  const grid = useRef<HTMLDivElement>(null);
  const resize = useRef<{ id: string; x: number; y: number; width: number; height: number; base: WidgetPlacement[] } | undefined>(undefined);
  const layout = preview ?? saved, positions = widgetPositions(layout);
  async function persist(next: WidgetPlacement[], message: string) {
    setPreview(undefined);
    const ok = await change(draft => { const settings = settingsFor(draft); draft.dashboardSettings = { ...settings, layouts: { ...settings.layouts, [page]: next } }; });
    setAnnouncement(ok ? message : 'Layout could not be saved. Please try again.');
  }
  function place(id: string, side: DockSide) {
    if (source.current && !busy) void persist(dockWidget(saved, source.current, id, side), 'Widget moved. Layout saved.');
    source.current = undefined; setTarget(undefined);
  }
  return <section className={'workspace-layout ' + (editing ? 'layout-editing' : '')} aria-label={page + ' widgets'}>
    {editing && <div className="layout-instructions"><span>Drag a grip to a widget’s left/right edge to split, or top/bottom to reorder. Resize from the corner.</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void persist(layoutFor(page), 'Default layout restored.') }><RotateCcw />Reset layout</Button></div>}
    <span className="sr-only" role="status">{announcement}</span>
    <div className="widget-grid" ref={grid}>
      {layout.map((item, index) => {
        const widget = widgets.find(x => x.id === item.id);
        if (!widget) return null;
        return <section key={item.id} data-widget={item.id} aria-label={widget.title + ' widget'}
          className={'workspace-widget ' + (target?.id === item.id ? 'dock-target dock-' + target.side : '')}
          style={{ '--widget-span': item.span, '--widget-column': positions[index].column, '--widget-row': positions[index].row } as CSSProperties}
          onDragOver={event => {
            if (!editing || busy || !source.current || source.current === item.id) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move';
            const rect = event.currentTarget.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
            const side = x < .25 ? 'left' : x > .75 ? 'right' : y < .5 ? 'before' : 'after';
            setTarget({ id: item.id, side });
          }}
          onDrop={event => { if (!source.current || !target || target.id !== item.id) return; event.preventDefault(); event.stopPropagation(); place(item.id, target.side); }}>
          {editing && <div className="widget-edit-bar">
            <Button variant="ghost" size="icon-sm" className="widget-grip" draggable={!busy} disabled={busy} aria-label={'Move ' + widget.title} title="Drag to dock. Alt + arrow keys to reorder."
              onDragStart={event => { source.current = item.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-academic-widget', item.id); }}
              onDragEnd={() => { source.current = undefined; setTarget(undefined); }}
              onKeyDown={event => { if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const other = saved[index + (event.key === 'ArrowUp' ? -1 : 1)]; if (other && !busy) void persist(dockWidget(saved, item.id, other.id, event.key === 'ArrowUp' ? 'before' : 'after'), 'Widget moved.'); } }}><GripVertical /></Button>
            <span>{widget.title}</span>
            <select aria-label={widget.title + ' width'} value={item.span} disabled={busy} onChange={event => void persist(resizeWidget(saved, item.id, Number(event.target.value), item.height), 'Widget resized.')}>{Array.from({ length: 10 }, (_, i) => i + 3).map(span => <option key={span} value={span}>{span === 12 ? 'Full' : span === 6 ? 'Half' : span === 4 ? 'Third' : span === 3 ? 'Quarter' : span + '/12'}</option>)}</select>
            <Button size="icon-sm" variant="ghost" disabled={busy || index === 0} aria-label={'Move ' + widget.title + ' up'} onClick={() => void persist(dockWidget(saved, item.id, saved[index - 1].id, 'before'), 'Widget moved.')}><ArrowUp /></Button>
            <Button size="icon-sm" variant="ghost" disabled={busy || index === layout.length - 1} aria-label={'Move ' + widget.title + ' down'} onClick={() => void persist(dockWidget(saved, item.id, saved[index + 1].id, 'after'), 'Widget moved.')}><ArrowDown /></Button>
            {item.height && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void persist(resizeWidget(saved, item.id, item.span), 'Natural height restored.')}>Auto height</Button>}
          </div>}
          <div className={'widget-body ' + (item.height ? 'widget-fixed-height' : '')} style={item.height ? { height: item.height } : undefined}>{widget.content}</div>
          {editing && <button className="widget-resize" disabled={busy} aria-label={'Resize ' + widget.title} title="Drag to resize. Arrow keys change width and height."
            onPointerDown={event => { if (event.button !== 0 || !grid.current) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); resize.current = { id: item.id, x: event.clientX, y: event.clientY, width: grid.current.clientWidth, height: event.currentTarget.parentElement!.querySelector('.widget-body')!.getBoundingClientRect().height, base: saved }; }}
            onPointerMove={event => { const r = resize.current; if (!r || r.id !== item.id) return; setPreview(resizeWidget(r.base, item.id, r.base.find(x => x.id === item.id)!.span + (event.clientX - r.x) / (r.width / 12), r.height + event.clientY - r.y)); }}
            onPointerUp={event => { if (!resize.current) return; resize.current = undefined; event.currentTarget.releasePointerCapture(event.pointerId); if (preview) void persist(preview, 'Widget resized. Layout saved.'); }}
            onPointerCancel={() => { resize.current = undefined; setPreview(undefined); }}
            onKeyDown={event => { if (!event.key.startsWith('Arrow') || busy) return; event.preventDefault(); void persist(resizeWidget(saved, item.id, item.span + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0), event.key === 'ArrowDown' || event.key === 'ArrowUp' ? (item.height ?? 300) + (event.key === 'ArrowDown' ? 40 : -40) : item.height), 'Widget resized.'); }}><Scaling size={14} /></button>}
        </section>;
      })}
    </div>
  </section>;
}
