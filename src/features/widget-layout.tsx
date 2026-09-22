import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Minus, Minimize2, Plus, RotateCcw, Scaling } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { layoutFor, moveWidget, positionedLayout, resizeGridWidget, type LayoutPage, type PositionedWidget, type WidgetPlacement } from '../data/layout';
import { settingsFor } from '../data/planning';
import type { Workspace } from '../platform/workspace';
import type { Change } from './forms';

export interface Widget { id: string; title: string; content: ReactNode }
type Interaction = {
  kind: 'move' | 'resize';
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  startHeight: number;
  base: PositionedWidget[];
};

export function WidgetLayout({ page, workspace, change, editing, busy, widgets }: {
  page: LayoutPage; workspace: Workspace; change: Change; editing: boolean; busy: boolean; widgets: Widget[];
}) {
  const saved = useMemo(() => layoutFor(page, settingsFor(workspace).layouts), [page, workspace]);
  const [preview, setPreview] = useState<WidgetPlacement[]>();
  const [interactionKind, setInteractionKind] = useState<Interaction['kind']>();
  const [announcement, setAnnouncement] = useState('');
  const grid = useRef<HTMLDivElement>(null);
  const interaction = useRef<Interaction | undefined>(undefined);
  const previewRef = useRef<WidgetPlacement[] | undefined>(undefined);
  const pendingPoint = useRef<{ x: number; y: number } | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);

  const layout = positionedLayout(preview ?? saved);
  const positions = new Map(layout.map(item => [item.id, item]));

  useEffect(() => () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
  }, []);


  function updatePreview(next: WidgetPlacement[]) {
    previewRef.current = next;
    setPreview(next);
  }

  async function persist(next: WidgetPlacement[], message: string) {
    previewRef.current = undefined;
    setPreview(undefined);
    const ok = await change(draft => {
      const settings = settingsFor(draft);
      draft.dashboardSettings = { ...settings, layouts: { ...settings.layouts, [page]: next } };
    });
    setAnnouncement(ok ? message : 'Layout could not be saved. Please try again.');
  }

  function rowAt(clientY: number, fallback: number) {
    const elements = [...(grid.current?.querySelectorAll<HTMLElement>('.workspace-widget') ?? [])];
    if (!elements.length) return fallback;
    const rows = new Map<number, { top: number; bottom: number }>();
    for (const element of elements) {
      const item = positions.get(element.dataset.widget ?? '');
      if (!item) continue;
      const rect = element.getBoundingClientRect();
      const current = rows.get(item.row);
      rows.set(item.row, current
        ? { top: Math.min(current.top, rect.top), bottom: Math.max(current.bottom, rect.bottom) }
        : { top: rect.top, bottom: rect.bottom });
    }
    const ordered = [...rows].sort((a, b) => a[0] - b[0]);
    if (clientY > ordered[ordered.length - 1][1].bottom + 20) return ordered[ordered.length - 1][0] + 1;
    return ordered.reduce((best, entry) => {
      const center = (entry[1].top + entry[1].bottom) / 2;
      const bestCenter = (best[1].top + best[1].bottom) / 2;
      return Math.abs(clientY - center) < Math.abs(clientY - bestCenter) ? entry : best;
    }, ordered[0])[0];
  }

  function schedule(clientX: number, clientY: number) {
    pendingPoint.current = { x: clientX, y: clientY };
    if (frame.current !== undefined) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      const active = interaction.current, point = pendingPoint.current, bounds = grid.current?.getBoundingClientRect();
      if (!active || !point || !bounds) return;
      const current = active.base.find(item => item.id === active.id)!;
      const unit = bounds.width / 12;
      if (active.kind === 'move') {
        const column = Math.round((point.x - bounds.left) / unit - current.span / 2) + 1;
        updatePreview(moveWidget(active.base, active.id, column, rowAt(point.y, current.row)));
      } else {
        const span = current.span + Math.round((point.x - active.startX) / unit);
        const vertical = point.y - active.startY;
        const height = Math.abs(vertical) < 12 && current.height === undefined
          ? undefined
          : active.startHeight + vertical;
        updatePreview(resizeGridWidget(active.base, active.id, span, height));
      }
    });
  }

  function begin(event: ReactPointerEvent<HTMLElement>, kind: Interaction['kind'], item: PositionedWidget) {
    if (event.button !== 0 || busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const body = event.currentTarget.closest<HTMLElement>('.workspace-widget')?.querySelector<HTMLElement>('.widget-body');
    interaction.current = {
      kind,
      id: item.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startHeight: item.height ?? body?.getBoundingClientRect().height ?? 320,
      base: positionedLayout(saved),
    };
    setInteractionKind(kind);
  }

  function finish(event: ReactPointerEvent<HTMLElement>, cancelled = false) {
    const active = interaction.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (frame.current !== undefined) {
      cancelAnimationFrame(frame.current);
      frame.current = undefined;
    }

    interaction.current = undefined;
    pendingPoint.current = undefined;
    setInteractionKind(undefined);
    const next = previewRef.current;
    if (cancelled || !next) {
      previewRef.current = undefined;
      setPreview(undefined);
      return;
    }
    void persist(next, active.kind === 'move' ? 'Widget moved. Layout saved.' : 'Widget resized. Layout saved.');
  }

  const pointerHandlers = {
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      if (interaction.current?.pointerId === event.pointerId) schedule(event.clientX, event.clientY);
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => finish(event),
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => finish(event, true),
  };

  return <section
    className={'workspace-layout workspace-layout-' + page + ' ' + (editing ? 'layout-editing ' : '') + (interactionKind ? 'layout-interacting layout-' + interactionKind : '')}
    aria-label={page + ' widgets'}
  >
    {editing && <div className="layout-toolbar">
      <p><strong>Arrange workspace</strong><span>Drag a grip to move. Drag the corner to resize width and height.</span></p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void persist(positionedLayout(layoutFor(page)), 'Default layout restored.')}><RotateCcw />Reset layout</Button>
    </div>}
    <span className="sr-only" role="status">{announcement}</span>
    <div className="widget-grid" ref={grid}>
      {layout.map(item => {
        const widget = widgets.find(candidate => candidate.id === item.id);
        if (!widget) return null;
        const pinned = item.height !== undefined;
        const style = {
          '--widget-span': item.span,
          '--widget-column': item.column,
          '--widget-row': item.row,
        } as CSSProperties;
        return <section
          key={item.id}
          data-widget={item.id}
          aria-label={widget.title + ' widget'}
          className={'workspace-widget ' + (interaction.current?.id === item.id ? 'widget-active' : '')}
          style={style}
        >
          {editing && <div className="widget-edit-bar">
            <Button
              variant="ghost"
              size="icon-sm"
              className="widget-grip"
              disabled={busy}
              aria-label={'Move ' + widget.title}
              title="Drag to move. Alt + Arrow keys also move this widget."
              onPointerDown={event => begin(event, 'move', item)}
              onKeyDown={event => {
                if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || busy) return;
                event.preventDefault();
                const column = item.column + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0);
                const row = item.row + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0);
                void persist(moveWidget(saved, item.id, column, row), 'Widget moved.');
              }}
              {...pointerHandlers}
            ><GripVertical /></Button>
            <span>{widget.title}</span>
            <select
              aria-label={widget.title + ' width'}
              value={item.span}
              disabled={busy}
              onChange={event => void persist(resizeGridWidget(saved, item.id, Number(event.target.value), item.height), 'Widget resized.')}
            >{Array.from({ length: 10 }, (_, value) => value + 3).map(span => <option key={span} value={span}>{span === 12 ? 'Full' : span === 6 ? 'Half' : span === 4 ? 'Third' : span === 3 ? 'Quarter' : span + '/12'}</option>)}</select>
            <Button size="icon-sm" variant="ghost" disabled={busy || item.row === 1} aria-label={'Move ' + widget.title + ' up'} onClick={() => void persist(moveWidget(saved, item.id, item.column, item.row - 1), 'Widget moved.')}><ArrowUp /></Button>
            <Button size="icon-sm" variant="ghost" disabled={busy} aria-label={'Move ' + widget.title + ' down'} onClick={() => void persist(moveWidget(saved, item.id, item.column, item.row + 1), 'Widget moved.')}><ArrowDown /></Button>
            <Button
              size="icon-sm"
              variant={pinned ? 'secondary' : 'ghost'}
              disabled={busy}
              aria-label={(pinned ? 'Unpin height of ' : 'Pin height of ') + widget.title}
              title={pinned ? 'Restore natural content height' : 'Pin to a resizable height'}
              onClick={() => void persist(resizeGridWidget(saved, item.id, item.span, pinned ? undefined : 400), pinned ? 'Natural height restored.' : 'Height pinned.')}
            ><Minimize2 size={14} /></Button>
            {pinned && <>
              <Button size="icon-sm" variant="ghost" disabled={busy} aria-label={'Shrink ' + widget.title} onClick={() => void persist(resizeGridWidget(saved, item.id, item.span, item.height! - 80), 'Height adjusted.')}><Minus size={12} /></Button>
              <Button size="icon-sm" variant="ghost" disabled={busy} aria-label={'Grow ' + widget.title} onClick={() => void persist(resizeGridWidget(saved, item.id, item.span, item.height! + 80), 'Height adjusted.')}><Plus size={12} /></Button>
            </>}
          </div>}
          <div className={'widget-body ' + (pinned ? 'widget-fixed-height' : '')} style={pinned ? { maxHeight: item.height } : undefined}>{widget.content}</div>
          {editing && <button
            className="widget-resize"
            disabled={busy}
            aria-label={'Resize ' + widget.title}
            title="Drag horizontally for width and vertically for height. Arrow keys resize; Shift + Up restores natural height."
            onPointerDown={event => begin(event, 'resize', item)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || busy) return;
              event.preventDefault();
              const span = item.span + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0);
              const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
              const height = !vertical
                ? item.height
                : event.shiftKey && event.key === 'ArrowUp'
                  ? undefined
                  : (item.height ?? 400) + (event.key === 'ArrowDown' ? 40 : -40);
              void persist(resizeGridWidget(saved, item.id, span, height), 'Widget resized.');
            }}
            {...pointerHandlers}
          ><Scaling size={14} /></button>}
        </section>;
      })}
    </div>
  </section>;
}
