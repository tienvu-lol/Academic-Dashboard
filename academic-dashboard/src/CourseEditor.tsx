import {useRef, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {ExternalLink, Trash2} from "lucide-react";
import {TextEditor} from "@fibery/custom-app-text-editor";
import "@fibery/custom-app-text-editor/style.css";
import {deleteEntity, getDocument, getEntityById, openEntity, setDocument, updateEntity, type DocumentContentJson, type SelectOption} from "@/lib/fibery";
import {Modal} from "@/components";
import {friendlyError, type Course} from "@/dashboard";

export function CourseEditor({course, academicYears, onClose}: {course: Course; academicYears: SelectOption[]; onClose: () => void}) {
  const queryClient = useQueryClient();
  const descriptionDraft = useRef<DocumentContentJson | null>(null);
  const [name, setName] = useState(course["University/Name"]);
  const [credits, setCredits] = useState(String(course["University/Credit Hours"] ?? 0));
  const [yearId, setYearId] = useState(course["University/Academic Year"]?.["fibery/id"] ?? "");

  const descriptionQuery = useQuery({
    queryKey: ["course-description", course["fibery/id"]],
    queryFn: async () => {
      const entity = await getEntityById<{"University/Description": {"Collaboration~Documents/secret": string} | null}>({
        type: "University/Courses",
        id: course["fibery/id"],
        fields: [{"University/Description": ["Collaboration~Documents/secret"]}],
      });
      const secret = entity?.["University/Description"]?.["Collaboration~Documents/secret"];
      if (!secret) return null;
      return {secret, content: await getDocument({secret})};
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required.");
      const result = await updateEntity({
        type: "University/Courses",
        id: course["fibery/id"],
        values: {
          "University/Name": name.trim(),
          "University/Credit Hours": Number(credits) || 0,
          "University/Academic Year": yearId ? {"fibery/id": yearId} : null,
        },
      });
      if (descriptionQuery.data?.secret && descriptionDraft.current) {
        await setDocument({secret: descriptionQuery.data.secret, content: descriptionDraft.current});
      }
      return result;
    },
    onSuccess: async () => {await queryClient.invalidateQueries({queryKey: ["courses"]}); onClose();},
  });
  const remove = useMutation({
    mutationFn: () => deleteEntity({type: "University/Courses", id: course["fibery/id"]}),
    onSuccess: async () => {await queryClient.invalidateQueries({queryKey: ["courses"]}); onClose();},
  });

  return (
    <Modal title="Edit course" onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => {event.preventDefault(); save.mutate();}}>
        <label className="block space-y-1.5 text-sm font-medium"><span>Name</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-medium"><span>Credit hours</span><input type="number" min="0" max="12" value={credits} onChange={(event) => setCredits(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
          <label className="block space-y-1.5 text-sm font-medium"><span>Academic term</span><select value={yearId} onChange={(event) => setYearId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"><option value="">Unassigned</option>{academicYears.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Description</span>
          {descriptionQuery.isLoading ? <div className="min-h-28 animate-pulse rounded-md bg-muted" /> : descriptionQuery.data ? <div className="min-h-32 cursor-text rounded-md border bg-background p-3"><TextEditor key={course["fibery/id"]} defaultValue={descriptionQuery.data.content} placeholder="Add course notes, links, or details…" onChange={(content) => {descriptionDraft.current = content;}} /></div> : <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No description document is available for this course.</p>}
        </div>
        <button type="button" onClick={() => openEntity({type: "University/Courses", publicId: course["fibery/public-id"]})} className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"><ExternalLink className="size-3.5" /> Open full course record</button>
        {(save.isError || remove.isError || descriptionQuery.isError) ? <p className="rounded-md border border-destructive p-3 text-xs text-destructive">{friendlyError(save.error ?? remove.error ?? descriptionQuery.error)}</p> : null}
        <div className="flex items-center justify-between border-t pt-4"><button type="button" disabled={remove.isPending} onClick={() => {if (window.confirm(`Delete “${course["University/Name"]}”? Courses linked to work may be affected.`)) remove.mutate();}} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent"><Trash2 className="size-4" /> Delete</button><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Cancel</button><button type="submit" disabled={save.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{save.isPending ? "Saving…" : "Save changes"}</button></div></div>
      </form>
    </Modal>
  );
}
