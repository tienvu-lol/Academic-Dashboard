import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GripVertical, ArrowUp, ArrowDown, Minus, Minimize2, Plus, RotateCcw, Scaling } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appendWidget, dockWidget, emptySlots, layoutFor, placeInSlot, resizeWidget, widgetPositions, type DockSide, type LayoutPage, type WidgetPlacement } from '../data/layout';
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
  const [emptyTarget, setEmptyTarget] = useState<{ row: number; column: number }>();
  const [appendTarget, setAppendTarget] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const source = useRef<string | undefined>(undefined);
  const grid = useRef<HTMLDivElement>(null);
  // Width-only resize: no Y tracking. Height is an explicit opt-in via the Pin button.
  const resize = useRef<{ id: string; x: number; width: number; base: WidgetPlacement[] } | undefined>(undefined);
  const layout = preview ?? saved, positions = widgetPositions(layout);
  const slots = (editing && dragging) ? emptySlots(saved.filter(x => x.id !== source.current)) : [];

  async function persist(next: WidgetPlacement[], message: string) {
    setPreview(undefined);
    const ok = await change(draft => { const settings = settingsFor(draft); draft.dashboardSettings = { ...settings, layouts: { ...settings.layouts, [page]: next } }; });
    setAnnouncement(ok ? message : 'Layout could not be saved. Please try again.');
  }
  function endDrag() { source.current = undefined; setTarget(undefined); setDragging(false); setEmptyTarget(undefined); setAppendTarget(false); }
  function place(id: string, side: DockSide) {
    if (source.current && !busy) void persist(dockWidget(saved, source.current, id, side), 'Widget moved. Layout saved.');
    endDrag();
  }
  return <section className={'workspace-layout workspace-layout-' + page + ' ' + (editing ? 'layout-editing' : '')} aria-label={page + ' widgets'}>
    {editing && <div className="layout-toolbar"><Button size="sm" variant="outline" disabled={busy} onClick={() => void persist(layoutFor(page), 'Default layout restored.')}><RotateCcw />Reset layout</Button></div>}
    <span className="sr-only" role="status">{announcement}</span>
    <div className="widget-grid" ref={grid}>
      {layout.map((item, index) => {
        const widget = widgets.find(x => x.id === item.id);
        if (!widget) return null;
        const pinned = !!item.height;
        return <section key={item.id} data-widget={item.id} aria-label={widget.title + ' widget'}
          className={'workspace-widget ' + (target?.id === item.id ? 'dock-target dock-' + target.side : '')}
          style={{ '--widget-span': item.span, '--widget-column': positions[index].column, '--widget-row': positions[index].row } as CSSProperties}
          onDragOver={event => {
            if (!editing || busy || !source.current || source.current === item.id) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move';
            const rect = event.currentTarget.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
            const side = x < .25 ? 'left' : x > .75 ? 'right' : y < .5 ? 'before' : 'after';
            setTarget({ id: item.id, side }); setEmptyTarget(undefined); setAppendTarget(false);
          }}
          onDrop={event => { if (!source.current || !target || target.id !== item.id) return; event.preventDefault(); event.stopPropagation(); place(item.id, target.side); }}>
          {editing && <div className="widget-edit-bar">
            <Button variant="ghost" size="icon-sm" className="widget-grip" draggable={!busy} disabled={busy} aria-label={'Move ' + widget.title} title="Drag to dock onto a widget or into empty space below."
              onDragStart={event => { source.current = item.id; setDragging(true); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-academic-widget', item.id); }}
              onDragEnd={endDrag}
              onKeyDown={event => { if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const other = saved[index + (event.key === 'ArrowUp' ? -1 : 1)]; if (other && !busy) void persist(dockWidget(saved, item.id, other.id, event.key === 'ArrowUp' ? 'before' : 'after'), 'Widget moved.'); } }}><GripVertical /></Button>
            <span>{widget.title}</span>
            <select aria-label={widget.title + ' width'} value={item.span} disabled={busy} onChange={event => void persist(resizeWidget(saved, item.id, Number(event.target.value), item.height), 'Widget resized.')}>{Array.from({ length: 10 }, (_, i) => i + 3).map(span => <option key={span} value={span}>{span === 12 ? 'Full' : span === 6 ? 'Half' : span === 4 ? 'Third' : span === 3 ? 'Quarter' : span + '/12'}</option>)}</select>
            <Button size="icon-sm" variant="ghost" disabled={busy || index === 0} aria-label={'Move ' + widget.title + ' up'} onClick={() => void persist(dockWidget(saved, item.id, saved[index - 1].id, 'before'), 'Widget moved.')}><ArrowUp /></Button>
            <Button size="icon-sm" variant="ghost" disabled={busy || index === layout.length - 1} aria-label={'Move ' + widget.title + ' down'} onClick={() => void persist(dockWidget(saved, item.id, saved[index + 1].id, 'after'), 'Widget moved.')}><ArrowDown /></Button>
            {/* Pin toggle: off = natural content height, on = fixed max-height with scrollbar */}
            <Button size="icon-sm" variant={pinned ? 'secondary' : 'ghost'} disabled={busy}
              aria-label={(pinned ? 'Unpin height of ' : 'Pin height of ') + widget.title}
              title={pinned ? 'Unpin — restore natural height' : 'Pin to a fixed height (content scrolls inside)'}
              onClick={() => void persist(
                pinned ? resizeWidget(saved, item.id, item.span) : resizeWidget(saved, item.id, item.span, 400),
                pinned ? 'Natural height restored.' : 'Height pinned.'
              )}><Minimize2 size={14} /></Button>
            {pinned && <>
              <Button size="icon-sm" variant="ghost" disabled={busy} aria-label={'Shrink ' + widget.title} title="Shrink"
                onClick={() => void persist(resizeWidget(saved, item.id, item.span, item.height! - 80), 'Height adjusted.')}><Minus size={12} /></Button>
              <Button size="icon-sm" variant="ghost" disabled={busy} aria-label={'Grow ' + widget.title} title="Grow"
                onClick={() => void persist(resizeWidget(saved, item.id, item.span, item.height! + 80), 'Height adjusted.')}><Plus size={12} /></Button>
            </>}
          </div>}
          {/* maxHeight so content flows naturally when short; only clips + scrolls when content exceeds the pinned value */}
          <div className={'widget-body ' + (pinned ? 'widget-fixed-height' : '')} style={pinned ? { maxHeight: item.height } : undefined}>{widget.content}</div>
          {editing && <button className="widget-resize" disabled={busy} aria-label={'Resize ' + widget.title + ' width'} title="Drag or ← → to adjust column width."
            onPointerDown={event => {
              if (event.button !== 0 || !grid.current) return;
              event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
              resize.current = { id: item.id, x: event.clientX, width: grid.current.clientWidth, base: saved };
            }}
            onPointerMove={event => {
              const r = resize.current;
              if (!r || r.id !== item.id) return;
              const base = r.base.find(x => x.id === item.id)!;
              // Only change span — height is untouched so it can never be accidentally set.
              setPreview(resizeWidget(r.base, item.id, base.span + (event.clientX - r.x) / (r.width / 12), base.height));
            }}
            onPointerUp={event => {
              if (!resize.current) return;
              resize.current = undefined; event.currentTarget.releasePointerCapture(event.pointerId);
              if (preview) void persist(preview, 'Width adjusted. Layout saved.');
            }}
            onPointerCancel={() => { resize.current = undefined; setPreview(undefined); }}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || busy) return;
              event.preventDefault();
              void persist(resizeWidget(saved, item.id, item.span + (event.key === 'ArrowRight' ? 1 : -1), item.height), 'Width adjusted.');
            }}><Scaling size={14} /></button>}
        </section>;
      })}
      {slots.map(slot => (
        <div key={`slot-${slot.row}-${slot.column}`}
          role="button"
          aria-label={`Empty space — drop widget here to fill row ${slot.row}`}
          className={'empty-slot-drop-zone' + (emptyTarget?.row === slot.row && emptyTarget?.column === slot.column ? ' slot-target' : '')}
          style={{ '--slot-span': slot.span, '--slot-column': slot.column, '--slot-row': slot.row } as CSSProperties}
          onDragOver={event => {
            if (!source.current || busy) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move';
            setEmptyTarget({ row: slot.row, column: slot.column }); setTarget(undefined); setAppendTarget(false);
          }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setEmptyTarget(undefined); }}
          onDrop={event => {
            if (!source.current || busy) return;
            event.preventDefault(); event.stopPropagation();
            const id = source.current; endDrag();
            void persist(placeInSlot(saved, id, slot.row), 'Widget placed. Layout saved.');
          }}
        />
      ))}
    </div>
    {editing && dragging && (
      <div
        role="button"
        aria-label="Drop widget here to place it at the end"
        className={'widget-append-zone' + (appendTarget ? ' slot-target' : '')}
        onDragOver={event => {
          if (!source.current || busy) return;
          event.preventDefault(); event.dataTransfer.dropEffect = 'move';
          setAppendTarget(true); setTarget(undefined); setEmptyTarget(undefined);
        }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setAppendTarget(false); }}
        onDrop={event => {
          if (!source.current || busy) return;
          event.preventDefault(); event.stopPropagation();
          const id = source.current; endDrag();
          void persist(appendWidget(saved, id), 'Widget moved to end. Layout saved.');
        }}
      />
    )}
  </section>;
}
