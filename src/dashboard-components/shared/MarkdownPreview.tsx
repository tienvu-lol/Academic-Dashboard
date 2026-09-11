import {Fragment, type ReactNode} from "react";

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{link[1]}</a>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-muted px-1 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Text is rendered as React nodes; imported HTML is never executed. */
export function MarkdownPreview({value}: {value: string}) {
  if (!value.trim()) return <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>;
  const blocks: ReactNode[] = [];
  let codeLines: string[] | null = null;

  for (const [index, line] of value.split("\n").entries()) {
    if (line.startsWith("```")) {
      if (codeLines) {
        blocks.push(<pre key={index} className="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code>{codeLines.join("\n")}</code></pre>);
        codeLines = null;
      } else codeLines = [];
      continue;
    }
    if (codeLines) {codeLines.push(line); continue;}
    if (line.startsWith("### ")) blocks.push(<h4 key={index} className="pt-1 text-sm font-semibold">{inlineMarkdown(line.slice(4))}</h4>);
    else if (line.startsWith("## ")) blocks.push(<h3 key={index} className="pt-1 text-base font-semibold">{inlineMarkdown(line.slice(3))}</h3>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={index} className="pt-1 text-lg font-semibold">{inlineMarkdown(line.slice(2))}</h2>);
    else if (/^- \[[ xX]\] /.test(line)) {
      const checked = line[3].toLowerCase() === "x";
      blocks.push(<div key={index} className={`flex gap-2 ${checked ? "text-muted-foreground line-through" : ""}`}><span role="img" aria-label={checked ? "Completed" : "Unchecked"} className="mt-1 grid size-4 shrink-0 place-items-center rounded border text-xs">{checked ? "\u2713" : ""}</span><span>{inlineMarkdown(line.slice(6))}</span></div>);
    } else if (line.startsWith("- ")) blocks.push(<div key={index} className="flex gap-2"><span aria-hidden="true">{"\u2022"}</span><span>{inlineMarkdown(line.slice(2))}</span></div>);
    else if (!line) blocks.push(<div key={index} className="h-2" />);
    else blocks.push(<p key={index} className="whitespace-pre-wrap">{inlineMarkdown(line)}</p>);
  }
  if (codeLines) blocks.push(<pre key="open-code" className="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code>{codeLines.join("\n")}</code></pre>);
  return <div className="space-y-1.5 break-words text-sm leading-6">{blocks}</div>;
}
