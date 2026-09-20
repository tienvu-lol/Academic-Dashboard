/** Renderer-independent, version-tolerant widget layout preferences. */
export type LayoutPage = 'dashboard' | 'internships';
export interface WidgetPlacement { id: string; span: number; height?: number }
export type Layouts = Partial<Record<LayoutPage, WidgetPlacement[]>>;
export type DockSide = 'before' | 'after' | 'left' | 'right';
/** An unoccupied column range at the trailing edge of a partially-filled grid row. */
export interface EmptySlot { row: number; column: number; span: number }

const defaults: Record<LayoutPage, WidgetPlacement[]> = {
  dashboard: [
    { id: 'upcoming', span: 4 }, { id: 'total', span: 4 }, { id: 'overdue', span: 4 },
    { id: 'tasks', span: 12 }, { id: 'calendar', span: 12 }, { id: 'timeline', span: 12 },
    { id: 'completions', span: 12 }, { id: 'notes', span: 12 }, { id: 'courses', span: 12 },
  ],
  internships: [
    { id: 'opportunities', span: 3 }, { id: 'applications', span: 3 }, { id: 'offers', span: 3 },
    { id: 'rejected', span: 3 }, { id: 'tracker', span: 12 }, { id: 'outcomes', span: 12 }, { id: 'activity', span: 12 },
  ],
};

export function layoutFor(page: LayoutPage, layouts?: Layouts): WidgetPlacement[] {
  const known = defaults[page], seen = new Set<string>();
  const saved = (layouts?.[page] ?? []).filter(item => {
    if (!known.some(x => x.id === item.id) || seen.has(item.id)) return false;
    seen.add(item.id); return true;
  });
  return [...saved, ...known.filter(item => !seen.has(item.id))].map(item => ({ ...item }));
}

export function dockWidget(layout: WidgetPlacement[], source: string, target: string, side: DockSide): WidgetPlacement[] {
  if (source === target || !layout.some(x => x.id === source) || !layout.some(x => x.id === target)) return layout;
  const moved = { ...layout.find(x => x.id === source)! };
  const result = layout.filter(x => x.id !== source).map(x => ({ ...x }));
  const index = result.findIndex(x => x.id === target);
  if (side === 'left' || side === 'right') {
    // Compute available columns in the target's row after source removal.
    const pos = widgetPositions(result);
    const targetRow = pos[index].row;
    const rowOtherSpan = result.reduce((s, item, i) =>
      pos[i].row === targetRow && item.id !== result[index].id ? s + item.span : s, 0);
    // Divide remaining space between source and target; guarantee at least span 3 each.
    const available = Math.max(6, 12 - rowOtherSpan);
    const sourceSpan = Math.max(3, Math.min(available - 3, Math.round(available / 2)));
    moved.span = sourceSpan;
    result[index].span = Math.max(3, available - sourceSpan);
  }
  result.splice(index + (side === 'after' || side === 'right' ? 1 : 0), 0, moved);
  return result;
}

/**
 * Move a widget into the trailing empty columns of an existing row.
 * The widget's span is set to fill exactly the vacant space (clamped to [3, 12]).
 */
export function placeInSlot(layout: WidgetPlacement[], sourceId: string, slotRow: number): WidgetPlacement[] {
  const without = layout.filter(x => x.id !== sourceId).map(x => ({ ...x }));
  const pos = widgetPositions(without);
  const rowItems = without.filter((_, i) => pos[i].row === slotRow);
  if (rowItems.length === 0) return layout; // slot no longer exists after source removal
  const rowUsed = rowItems.reduce((s, w) => s + w.span, 0);
  const slack = 12 - rowUsed;
  if (slack < 3) return layout; // not enough room to place even a minimum-width widget
  const source: WidgetPlacement = { ...layout.find(x => x.id === sourceId)!, span: Math.min(12, slack) };
  // Insert immediately after the last widget in the target row.
  const lastInRow = rowItems[rowItems.length - 1];
  const insertAfter = without.findIndex(x => x.id === lastInRow.id);
  without.splice(insertAfter + 1, 0, source);
  return without;
}

export function resizeWidget(layout: WidgetPlacement[], id: string, span: number, height?: number) {
  return layout.map(item => item.id === id ? { id, span: Math.max(3, Math.min(12, Math.round(span))), ...(height === undefined ? {} : { height: Math.max(140, Math.min(1600, Math.round(height))) }) } : { ...item });
}

/** Explicit row packing: wrap only when a widget would exceed column 12. */
export function widgetPositions(layout: WidgetPlacement[]) {
  let row = 1, used = 0;
  return layout.map(item => {
    if (used && used + item.span > 12) { row++; used = 0; }
    const position = { column: used + 1, row };
    used += item.span;
    if (used === 12) { row++; used = 0; }
    return position;
  });
}

/**
 * Return the unoccupied trailing column ranges for each partially-filled grid row.
 * Used to render drop zones for empty-space placement during layout editing.
 */
export function emptySlots(layout: WidgetPlacement[]): EmptySlot[] {
  const positions = widgetPositions(layout);
  const rowInfo: Record<number, { used: number; maxEndCol: number }> = {};
  for (let i = 0; i < layout.length; i++) {
    const { row, column } = positions[i];
    const span = layout[i].span;
    if (!rowInfo[row]) rowInfo[row] = { used: 0, maxEndCol: 0 };
    rowInfo[row].used += span;
    rowInfo[row].maxEndCol = Math.max(rowInfo[row].maxEndCol, column + span - 1);
  }
  return Object.entries(rowInfo)
    .filter(([, { used }]) => used < 12 && 12 - used >= 3)
    .map(([rowStr, { used, maxEndCol }]) => ({
      row: Number(rowStr),
      column: maxEndCol + 1,
      span: 12 - used,
    }));
}

/**
 * Move source to the end of the layout.
 * Fills trailing space in the last row when ≥3 columns remain, otherwise starts a new full-width row.
 */
export function appendWidget(layout: WidgetPlacement[], sourceId: string): WidgetPlacement[] {
  const without = layout.filter(x => x.id !== sourceId).map(x => ({ ...x }));
  const source = { ...layout.find(x => x.id === sourceId)! };
  if (without.length === 0) { source.span = 12; return [source]; }
  const pos = widgetPositions(without);
  const lastRow = pos[pos.length - 1].row;
  const lastRowUsed = without.reduce((s, item, i) => pos[i].row === lastRow ? s + item.span : s, 0);
  const slack = 12 - lastRowUsed;
  source.span = slack >= 3 ? Math.min(12, slack) : 12;
  return [...without, source];
}

export function validLayouts(value: unknown): value is Layouts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([page, entries]) => {
    if (!Object.hasOwn(defaults, page) || !Array.isArray(entries) || entries.length > 40) return false;
    const ids = new Set<string>();
    return entries.every(item => {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || ids.has(item.id) ||
        !defaults[page as LayoutPage].some(x => x.id === item.id) ||
        !Number.isInteger(item.span) || item.span < 3 || item.span > 12 ||
        (item.height !== undefined && (!Number.isInteger(item.height) || item.height < 140 || item.height > 1600))) return false;
      ids.add(item.id); return true;
    });
  });
}
