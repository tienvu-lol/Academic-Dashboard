import {Fragment, useEffect, useRef, useState, type ReactNode} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Bold, CheckSquare, Code2, Eye, Heading2, Italic, List, NotebookPen, Pencil, Plus, Save, Trash2} from "lucide-react";
import {createEntity, deleteEntity, queryEntities, updateEntity} from "@/lib/fibery";
import {cn} from "@/lib/cn";
import {friendlyError, type DashboardNote} from "@/dashboard";

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-muted px-1 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function MarkdownPreview({value}: {value: string}) {
  if (!value.trim()) return <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>;
  return <div className="space-y-1.5 text-sm leading-6">{value.split("\n").map((line, index) => {
    if (line.startsWith("### ")) return <h4 key={index} className="pt-1 text-sm font-semibold">{inlineMarkdown(line.slice(4))}</h4>;
    if (line.startsWith("## ")) return <h3 key={index} className="pt-1 text-base font-semibold">{inlineMarkdown(line.slice(3))}</h3>;
    if (line.startsWith("# ")) return <h2 key={index} className="pt-1 text-lg font-semibold">{inlineMarkdown(line.slice(2))}</h2>;
    if (line.startsWith("- [ ] ")) return <div key={index} className="flex gap-2"><span className="mt-1 size-4 rounded border" /> <span>{inlineMarkdown(line.slice(6))}</span></div>;
    if (line.startsWith("- [x] ") || line.startsWith("- [X] ")) return <div key={index} className="flex gap-2 text-muted-foreground line-through"><span className="mt-1 grid size-4 place-items-center rounded border">✓</span> <span>{inlineMarkdown(line.slice(6))}</span></div>;
    if (line.startsWith("- ")) return <div key={index} className="flex gap-2"><span>•</span><span>{inlineMarkdown(line.slice(2))}</span></div>;
    if (!line) return <div key={index} className="h-2" />;
    return <p key={index}>{inlineMarkdown(line)}</p>;
  })}</div>;
}

export function NotesPanel() {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedId, setSelectedId] = useState("__initial__");
  const [title, setTitle] = useState("Dashboard notes");
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);

  const notesQuery = useQuery({
    queryKey: ["dashboard-notes"],
    queryFn: () => queryEntities<DashboardNote>({type: "University/Dashboard Notes", fields: ["fibery/id", "fibery/public-id", "University/Name", "University/Markdown"], orderBy: {field: "fibery/modification-date", direction: "desc"}, limit: 50}),
  });
  const notes = notesQuery.data ?? [];

  useEffect(() => {
    if (selectedId === "__initial__" && notesQuery.isSuccess) setSelectedId(notes[0]?.["fibery/id"] ?? "__new__");
  }, [notes, notesQuery.isSuccess, selectedId]);

  useEffect(() => {
    if (!selectedId || selectedId === "__new__" || selectedId === "__initial__") return;
    const note = notes.find((candidate) => candidate["fibery/id"] === selectedId);
    if (!note) return;
    setTitle(note["University/Name"]);
    setText(note["University/Markdown"] ?? "");
    setDirty(false);
  }, [selectedId]);

  const save = useMutation({
    mutationFn: () => {
      if (!title.trim()) throw new Error("Note title is required.");
      if (selectedId && selectedId !== "__new__" && selectedId !== "__initial__") return updateEntity<DashboardNote>({type: "University/Dashboard Notes", id: selectedId, values: {"University/Name": title.trim(), "University/Markdown": text}});
      return createEntity<DashboardNote>({type: "University/Dashboard Notes", values: {"University/Name": title.trim(), "University/Markdown": text}});
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({queryKey: ["dashboard-notes"]});
      if (result?.["fibery/id"]) setSelectedId(result["fibery/id"]);
      setDirty(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteEntity({type: "University/Dashboard Notes", id: selectedId}),
    onSuccess: async () => {
      setSelectedId("__new__"); setTitle("Dashboard notes"); setText(""); setDirty(false);
      await queryClient.invalidateQueries({queryKey: ["dashboard-notes"]});
    },
  });

  function startNew() { setSelectedId("__new__"); setTitle("Untitled note"); setText(""); setDirty(false); setPreview(false); }

  function insert(before: string, after = "", linePrefix = false) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);
    const lineStart = linePrefix ? text.lastIndexOf("\n", start - 1) + 1 : start;
    const next = linePrefix ? `${text.slice(0, lineStart)}${before}${text.slice(lineStart)}` : `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
    setText(next); setDirty(true);
    requestAnimationFrame(() => {textarea.focus(); const cursor = linePrefix ? start + before.length : start + before.length + selected.length; textarea.setSelectionRange(cursor, cursor);});
  }

  const tools = [
    {label: "Heading", icon: <Heading2 className="size-3.5" />, action: () => insert("## ", "", true)},
    {label: "Bold", icon: <Bold className="size-3.5" />, action: () => insert("**", "**")},
    {label: "Italic", icon: <Italic className="size-3.5" />, action: () => insert("*", "*")},
    {label: "List", icon: <List className="size-3.5" />, action: () => insert("- ", "", true)},
    {label: "Task", icon: <CheckSquare className="size-3.5" />, action: () => insert("- [ ] ", "", true)},
    {label: "Code", icon: <Code2 className="size-3.5" />, action: () => insert("`", "`")},
  ];

  return (
    <div className="flex h-full min-h-56 flex-col rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <NotebookPen className="size-4 text-violet" />
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"><option value="__new__">New note</option>{notes.map((note) => <option key={note["fibery/id"]} value={note["fibery/id"]}>{note["University/Name"]}</option>)}</select>
        <button type="button" onClick={startNew} className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent" aria-label="New note"><Plus className="size-3.5" /></button>
        <button type="button" onClick={() => setPreview((value) => !value)} className={cn("rounded-md border p-1.5", preview ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent")} aria-label={preview ? "Edit note" : "Preview note"}>{preview ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}</button>
      </div>
      <input value={title} onChange={(event) => {setTitle(event.target.value); setDirty(true);}} className="mb-2 w-full border-b bg-transparent pb-1 text-xs font-medium outline-none focus:border-primary" aria-label="Note title" />
      {!preview ? <div className="mb-2 flex flex-wrap gap-1 rounded-md bg-muted p-1">{tools.map((tool) => <button key={tool.label} type="button" title={tool.label} onClick={tool.action} className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">{tool.icon}</button>)}</div> : null}
      {preview ? <div className="min-h-28 flex-1 overflow-y-auto rounded-md border p-3"><MarkdownPreview value={text} /></div> : <textarea ref={textareaRef} value={text} onChange={(event) => {setText(event.target.value); setDirty(true);}} className="min-h-28 flex-1 resize-none rounded-md border bg-background p-3 font-mono text-xs leading-5 outline-none focus:ring-2 focus:ring-ring" placeholder="# Quick notes\n- [ ] Something to remember" />}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">{selectedId && selectedId !== "__new__" && selectedId !== "__initial__" ? <button type="button" onClick={() => {if (window.confirm(`Delete “${title}”?`)) remove.mutate();}} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive" aria-label="Delete note"><Trash2 className="size-3.5" /></button> : null}<span className="text-[10px] text-muted-foreground">{dirty ? "Unsaved changes" : "Saved in Fibery"}</span></div>
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !dirty} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"><Save className="size-3.5" /> {save.isPending ? "Saving…" : "Save"}</button>
      </div>
      {(notesQuery.isError || save.isError || remove.isError) ? <p className="mt-2 text-[10px] text-destructive">{friendlyError(notesQuery.error ?? save.error ?? remove.error)}</p> : null}
    </div>
  );
}
