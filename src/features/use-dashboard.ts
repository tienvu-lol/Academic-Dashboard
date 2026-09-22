import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workspace } from '../platform/workspace';
import { todayLocal } from '../internships/model';

export interface Snapshot { workspace: Workspace; revision: number }
declare global { interface Window { dashboard?: { load(): Promise<Snapshot>; save(snapshot: Snapshot): Promise<Snapshot> } } }
export function useDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = useRef<Snapshot | undefined>(undefined);
  const locked = useRef(false);
  const load = useCallback(async () => {
    try {
      if (!window.dashboard) throw new Error('Open the desktop application with bun run dev to access your saved workspace.');
      const next = await window.dashboard.load(); current.current = next; setSnapshot(next); setError('');
    } catch (e) { setError(String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let day = todayLocal();
    const timer = setInterval(() => {
      const next = todayLocal();
      if (next !== day && !locked.current) { day = next; void load(); }
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);
  const change = useCallback(async (update: (draft: Workspace) => void): Promise<boolean> => {
    if (!current.current || locked.current || !window.dashboard) return false;
    locked.current = true; setBusy(true); setError('');
    try {
      const next = structuredClone(current.current); update(next.workspace);
      next.workspace.academic.updatedAt = new Date().toISOString();
      const saved = await window.dashboard.save(next); current.current = saved; setSnapshot(saved); return true;
    } catch (e) { setError(String(e)); return false; }
    finally { locked.current = false; setBusy(false); }
  }, []);
  return { workspace: snapshot?.workspace, change, busy, error, load };
}
