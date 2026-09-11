import {useEffect, useRef, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Bold, CheckSquare, Code2, Eye, Heading2, Italic, List, NotebookPen, Pencil, Plus, Save, Trash2} from "lucide-react";
import {createEntity, deleteEntity, queryEntities, updateEntity} from "@/lib/fibery";
import {cn} from "@/lib/cn";
import {friendlyError, type DashboardNote} from "@/dashboard";
import {MarkdownPreview} from "@/dashboard-components/shared/MarkdownPreview";

const NEW_NOTE = "__new__";
const INITIAL_NOTE = "__initial__";
const DRAFT_KEY = "academic-dashboard-note-draft";

type NoteDraft = {id: string; title: string; text: string};

function readDraft(): NoteDraft | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    const draft = value as Partial<NoteDraft>;
    return typeof draft.id === "string" && typeof draft.title === "string" && typeof draft.text === "string" ? draft as NoteDraft : null;
  } catch {return null;}
}

export function NotesPanel() {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [restoredDraft] = useState(readDraft);
  const [selectedId, setSelectedId] = useState(restoredDraft?.id ?? INITIAL_NOTE);
  const [title, setTitle] = useState(restoredDraft?.title ?? "Dashboard notes");
  const [text, setText] = useState(restoredDraft?.text ?? "");
  const [dirty, setDirty] = useState(Boolean(restoredDraft));
  const [preview, setPreview] = useState(false);
  const latestDraft = useRef<NoteDraft>({id: selectedId, title, text});
  latestDraft.current = {id: selectedId, title, text};

  const notesQuery = useQuery({
    queryKey: ["dashboard-notes"],
    queryFn: () => queryEntities<DashboardNote>({
      type: "University/Dashboard Notes",
      fields: ["fibery/id", "fibery/public-id", "University/Name", "University/Markdown"],
      orderBy: {field: "fibery/modification-date", direction: "desc"},
    }),
  });
  const notes = notesQuery.data ?? [];
  const isExisting = selectedId !== NEW_NOTE && selectedId !== INITIAL_NOTE;

  useEffect(() => {
    if (selectedId !== INITIAL_NOTE || !notesQuery.isSuccess) return;
    const note = notesQuery.data?.[0];
    setSelectedId(note?.["fibery/id"] ?? NEW_NOTE);
    setTitle(note?.["University/Name"] ?? "Dashboard notes");
    setText(note?.["University/Markdown"] ?? "");
  }, [notesQuery.data, notesQuery.isSuccess, selectedId]);

  useEffect(() => {
    if (dirty || !isExisting || !notesQuery.isSuccess) return;
    const current = notesQuery.data.find((note) => note["fibery/id"] === selectedId);
    const note = current ?? notesQuery.data[0];
    setSelectedId(note?.["fibery/id"] ?? NEW_NOTE);
    setTitle(note?.["University/Name"] ?? "Dashboard notes");
    setText(note?.["University/Markdown"] ?? "");
  }, [dirty, isExisting, notesQuery.data, notesQuery.isSuccess, selectedId]);

  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({id: selectedId, title, text}));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* Explicit Save remains available when browser session storage is full. */ }
  }, [dirty, selectedId, title, text]);

  useEffect(() => {
    if (!dirty) return;
    const protectDraft = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = "";};
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [dirty]);

  const save = useMutation({
    mutationFn: (draft: NoteDraft) => {
      if (!draft.title.trim()) throw new Error("Note title is required.");
      const values = {"University/Name": draft.title.trim(), "University/Markdown": draft.text};
      if (draft.id !== NEW_NOTE && draft.id !== INITIAL_NOTE) return updateEntity<DashboardNote>({type: "University/Dashboard Notes", id: draft.id, values});
      return createEntity<DashboardNote>({type: "University/Dashboard Notes", values});
    },
    onSuccess: async (result, saved) => {
      queryClient.setQueryData<DashboardNote[]>(["dashboard-notes"], (current) => [result, ...(current ?? []).filter((note) => note["fibery/id"] !== result["fibery/id"])]);
      const current = latestDraft.current;
      if (current.id === saved.id) {
        setSelectedId(result["fibery/id"]);
        if (current.title === saved.title && current.text === saved.text) {
          setTitle(result["University/Name"]);
          setDirty(false);
        }
      }
      await queryClient.invalidateQueries({queryKey: ["dashboard-notes"]});
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEntity({type: "University/Dashboard Notes", id}),
    onSuccess: async () => {
      loadNote(NEW_NOTE);
      await queryClient.invalidateQueries({queryKey: ["dashboard-notes"]});
    },
  });
  const busy = save.isPending || remove.isPending;

  function loadNote(id: string) {
    const note = notes.find((candidate) => candidate["fibery/id"] === id);
    setSelectedId(note?.["fibery/id"] ?? NEW_NOTE);
    setTitle(note?.["University/Name"] ?? "Untitled note");
    setText(note?.["University/Markdown"] ?? "");
    setDirty(false);
    setPreview(false);
    save.reset();
    remove.reset();
  }

  function selectNote(id: string) {
    if (id === selectedId && id !== NEW_NOTE) return;
    if (dirty && !window.confirm("Discard unsaved changes to this note?")) return;
    loadNote(id);
  }

  function insert(before: string, after = "", linePrefix = false) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);
    const lineStart = linePrefix ? text.lastIndexOf("\n", start - 1) + 1 : start;
    const next = linePrefix ? `${text.slice(0, lineStart)}${before}${text.slice(lineStart)}` : `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
    setText(next);
    setDirty(true);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = linePrefix ? start + before.length : start + before.length + selected.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  const formattingTools = [
    {label: "Insert heading", icon: Heading2, action: () => insert("## ", "", true)},
    {label: "Bold", icon: Bold, action: () => insert("**", "**")},
    {label: "Italic", icon: Italic, action: () => insert("*", "*")},
    {label: "Insert list", icon: List, action: () => insert("- ", "", true)},
    {label: "Insert checkbox", icon: CheckSquare, action: () => insert("- [ ] ", "", true)},
    {label: "Inline code", icon: Code2, action: () => insert("`", "`")},
  ];
  const status = notesQuery.isLoading ? "Loading notes..." : dirty ? "Unsaved changes" : isExisting ? "Saved locally" : "New note · not saved yet";

  return (
    <section aria-label="Dashboard notes" className="flex h-full min-h-56 flex-col rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <NotebookPen className="size-4 shrink-0 text-violet" />
        <select aria-label="Select note" value={selectedId} disabled={busy || notesQuery.isLoading} onChange={(event) => selectNote(event.target.value)} className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
          {selectedId === INITIAL_NOTE ? <option value={INITIAL_NOTE}>Loading notes...</option> : null}
          <option value={NEW_NOTE}>New note</option>
          {isExisting && !notes.some((note) => note["fibery/id"] === selectedId) ? <option value={selectedId}>{title} (draft)</option> : null}
          {notes.map((note) => <option key={note["fibery/id"]} value={note["fibery/id"]}>{note["University/Name"]}</option>)}
        </select>
        <button type="button" disabled={busy || notesQuery.isLoading} onClick={() => selectNote(NEW_NOTE)} className="rounded-md border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50" aria-label="New note"><Plus className="size-4" /></button>
        <button type="button" onClick={() => setPreview((value) => !value)} className={cn("rounded-md border p-2", preview ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent")} aria-pressed={preview} aria-label={preview ? "Edit note" : "Preview note"}>{preview ? <Pencil className="size-4" /> : <Eye className="size-4" />}</button>
      </div>
      <input value={title} disabled={busy || notesQuery.isLoading} onChange={(event) => {setTitle(event.target.value); setDirty(true);}} className="mb-3 w-full border-b bg-transparent pb-2 text-sm font-medium outline-none focus:border-primary" aria-label="Note title" />
      {!preview ? <div role="group" aria-label="Markdown formatting" className="mb-3 flex flex-wrap gap-1 rounded-md bg-muted p-1">{formattingTools.map(({label, icon: Icon, action}) => <button key={label} type="button" title={label} aria-label={label} disabled={busy || notesQuery.isLoading} onClick={action} className="rounded p-2 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"><Icon className="size-4" /></button>)}</div> : null}
      {preview ? <div className="min-h-36 flex-1 overflow-y-auto rounded-md border p-3"><MarkdownPreview value={text} /></div> : (
        <textarea ref={textareaRef} aria-label="Note content" value={text} disabled={busy || notesQuery.isLoading} onChange={(event) => {setText(event.target.value); setDirty(true);}} onKeyDown={(event) => {if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {event.preventDefault(); if (dirty && !busy) save.mutate({id: selectedId, title, text});}}} className="min-h-36 flex-1 resize-y rounded-md border bg-background p-3 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-ring" placeholder={"# Quick notes\n- [ ] Something to remember"} />
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isExisting ? <button type="button" disabled={busy} onClick={() => {if (window.confirm(`Delete “${title}”? This cannot be undone.`)) remove.mutate(selectedId);}} className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50" aria-label="Delete note"><Trash2 className="size-4" /></button> : null}
          <span role="status" className="text-xs text-muted-foreground">{status}</span>
        </div>
        <button type="button" onClick={() => save.mutate({id: selectedId, title, text})} disabled={busy || !dirty || notesQuery.isLoading} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"><Save className="size-4" /> {save.isPending ? "Saving..." : "Save"}</button>
      </div>
      {(notesQuery.isError || save.isError || remove.isError) ? <p role="alert" className="mt-2 text-xs text-destructive">{friendlyError(notesQuery.error ?? save.error ?? remove.error)}</p> : null}
    </section>
  );
}
