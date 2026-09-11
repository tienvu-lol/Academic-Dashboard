import {useEffect, useId, useState} from "react";
import {Eye, Pencil} from "lucide-react";
import type {DocumentContentJson, DocumentNodeJson} from "@/lib/fibery";
import {MarkdownPreview} from "@/dashboard-components/shared/MarkdownPreview";

type LocalDocument = DocumentContentJson & {localMarkdown?: string};

function nodeMarkdown(node: DocumentNodeJson): string {
  if (node.type === "hard_break" || node.type === "hardBreak") return "\n";
  if (node.text !== undefined) {
    return (node.marks ?? []).reduce((text, mark) => {
      if (mark.type === "bold" || mark.type === "strong") return `**${text}**`;
      if (mark.type === "italic" || mark.type === "em") return `*${text}*`;
      if (mark.type === "code") return `\`${text}\``;
      if (mark.type === "link" && typeof mark.attrs?.href === "string") return `[${text}](${mark.attrs.href})`;
      return text;
    }, node.text);
  }
  const children = (node.content ?? []).map(nodeMarkdown).join("");
  if (node.type === "heading") return `${"#".repeat(Math.max(1, Math.min(6, Number(node.attrs?.level) || 2)))} ${children}\n`;
  if (node.type === "paragraph") return `${children}\n`;
  if (node.type === "list_item" || node.type === "listItem") return `- ${children.trimEnd()}\n`;
  if (node.type === "taskItem" || node.type === "task_item") return `- [${node.attrs?.checked ? "x" : " "}] ${children.trimEnd()}\n`;
  if (node.type === "code_block" || node.type === "codeBlock") return `\`\`\`\n${children}\n\`\`\`\n`;
  if (children) return children;
  if (typeof node.attrs?.src === "string") return `[${String(node.attrs.alt ?? "Attachment")}](${node.attrs.src})\n`;
  if (typeof node.attrs?.label === "string") return node.attrs.label;
  if (typeof node.attrs?.text === "string") return node.attrs.text;
  return "";
}

function documentMarkdown(content: LocalDocument) {
  return content.localMarkdown ?? (content.doc?.content ?? []).map(nodeMarkdown).join("").trimEnd();
}

export function DescriptionEditor({defaultValue, placeholder = "Add notes, links, or details...", onChange}: {
  defaultValue: DocumentContentJson;
  placeholder?: string;
  onChange: (content: DocumentContentJson) => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState(() => documentMarkdown(defaultValue));
  const [preview, setPreview] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (!changed) setValue(documentMarkdown(defaultValue));
  }, [defaultValue, changed]);

  function update(markdown: string) {
    setValue(markdown);
    setChanged(true);
    // Retain the complete imported document (including comments and attachments).
    // The local overlay is copied and exported together with its original content.
    const next: LocalDocument = {...defaultValue, localMarkdown: markdown};
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs text-muted-foreground">Notes and details · Markdown supported</label>
        <button type="button" onClick={() => setPreview((current) => !current)} aria-pressed={preview} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
          {preview ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}{preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? <div className="min-h-32 rounded-md border bg-background p-3"><MarkdownPreview value={value} /></div> : <textarea id={inputId} value={value} onChange={(event) => update(event.target.value)} placeholder={placeholder} rows={6} className="min-h-32 w-full resize-y rounded-md border bg-background p-3 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-ring" />}
    </div>
  );
}
