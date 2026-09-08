import type {ReactNode} from "react";
import {X} from "lucide-react";
import {cn} from "@/lib/cn";

export function SectionTitle({icon, title, detail}: {icon: ReactNode; title: string; detail?: string}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">{icon}</span>
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
        {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

export function DataBadge({label, color, className}: {label: string; color?: string | null; className?: string}) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground", className)}
      title={label}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full ring-2 ring-background", !color && "bg-muted-foreground")} style={color ? {backgroundColor: color} : undefined} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className={cn("rounded-lg p-1.5", tone)}>{icon}</span>
      </div>
    </div>
  );
}

export function Toggle({checked, onChange, label}: {checked: boolean; onChange: () => void; label?: string}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn("relative h-6 w-11 rounded-full border transition-colors", checked ? "bg-primary" : "bg-muted")}
    >
      <span className={cn("absolute left-1 top-1/2 size-4 -translate-y-1/2 rounded-full bg-background shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
    </button>
  );
}

export function Modal({title, children, onClose}: {title: string; children: ReactNode; onClose: () => void}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ChartTooltip({active, payload, label}: {active?: boolean; payload?: Array<{value?: number}>; label?: string}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{label}</p>
      <p className="mt-0.5 text-muted-foreground">{payload[0]?.value ?? 0} completed</p>
    </div>
  );
}
