import {lazy, Suspense, useEffect, useState} from "react";
import {BookOpen, BriefcaseBusiness, ChevronLeft, Database, HardDrive, LayoutDashboard, Menu, Sparkles, X} from "lucide-react";
import {cn} from "@/lib/cn";

const AcademicPage = lazy(() => import("./academic/AcademicPage"));
const InternshipPage = lazy(() => import("./internships/InternshipPage"));
const DataManagement = lazy(() => import("./data/DataManagement"));

// Add pages here as the workspace grows. Each page owns its UI and data model.
const pages = [
  {id: "academic", label: "Academic dashboard", short: "Academics", icon: LayoutDashboard},
  {id: "internships", label: "Internship applications", short: "Internships", icon: BriefcaseBusiness},
  {id: "data", label: "Import & backup", short: "Import & backup", icon: Database},
] as const;
type PageId = typeof pages[number]["id"];

function currentPage(): PageId {
  const hash = window.location.hash.slice(1);
  return pages.find((page) => page.id === hash)?.id ?? "academic";
}

export default function App() {
  const [page, setPage] = useState<PageId>(currentPage);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const navigate = () => {setPage(currentPage()); setMobileOpen(false);};
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);

  return (
    <div className={cn("workspace", collapsed && "workspace-collapsed")}>
      <a href="#page-content" className="skip-link">Skip to content</a>
      <div className="mobile-header">
        <span className="flex items-center gap-2 font-semibold"><Sparkles className="size-5 text-aquamarine" /> Academic workspace</span>
        <button className="rounded-lg border p-2" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button>
      </div>
      <aside className={cn("workspace-sidebar", mobileOpen && "is-open")} aria-label="Workspace sidebar">
        <a href="#academic" className="sidebar-brand" aria-label="Academic workspace home">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl highlight-aquamarine"><Sparkles className="size-5" /></span>
          <span className="sidebar-expanded"><strong className="block text-sm font-semibold">Academic</strong><span className="text-xs text-muted-foreground">Your personal workspace</span></span>
        </a>
        <div className="sidebar-expanded mb-3 mt-10 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
        <nav aria-label="Main navigation" className="space-y-1.5">
          {pages.map(({id, label, short, icon: Icon}, index) => (
            <a key={id} href={`#${id}`} onClick={() => setMobileOpen(false)} aria-current={page === id ? "page" : undefined} title={label} className={cn("sidebar-link", page === id && "is-active")}>
              <Icon className="size-[18px] shrink-0" /><span className="sidebar-expanded flex-1">{short}</span><span className="sidebar-expanded text-[10px] opacity-50">0{index + 1}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-expanded mt-8 rounded-xl border border-sidebar-border bg-background/40 p-4">
          <BookOpen className="mb-3 size-4 text-muted-foreground" />
          <p className="text-xs font-medium">A little progress, every day.</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Your courses, plans, and next opportunities in one place.</p>
        </div>
        <div className="mt-auto pt-10">
          <div className="flex items-center gap-2 border-t border-sidebar-border px-3 pt-5 text-xs text-muted-foreground" title="Records are stored in this browser">
            <HardDrive className="size-4 shrink-0 text-aquamarine" /><span className="sidebar-expanded">Stored on this device</span>
          </div>
          <button className="sidebar-collapse mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronLeft className={cn("size-4 shrink-0", collapsed && "rotate-180")} /><span className="sidebar-expanded">Collapse sidebar</span>
          </button>
        </div>
      </aside>
      <div className="workspace-content" id="page-content" tabIndex={-1}>
        <div className="workspace-topbar"><span>My workspace <span className="mx-2 opacity-40">/</span> <span className="text-foreground">{pages.find((item) => item.id === page)?.short}</span></span><span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[var(--highlight-aquamarine-fg)]" /> Local workspace</span></div>
        <Suspense fallback={<div role="status" className="p-8 text-sm text-muted-foreground">Opening your workspace…</div>}>
          {page === "academic" ? <AcademicPage /> : page === "internships" ? <InternshipPage /> : <DataManagement />}
        </Suspense>
      </div>
    </div>
  );
}
