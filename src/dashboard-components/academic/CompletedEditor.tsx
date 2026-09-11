import {useRef, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Trash2} from "lucide-react";
import {DescriptionEditor} from "@/dashboard-components/shared/DescriptionEditor";

import {deleteEntity, getDocument, getEntityById, setDocument, updateEntity, type DocumentContentJson, type SelectOption} from "@/lib/fibery";
import {Modal} from "@/dashboard-components/shared/components";
import {friendlyError, type CompletedWork, type Course} from "@/dashboard";

export function CompletedEditor({
  item,
  courses,
  priorities,
  categories,
  types,
  onClose,
}: {
  item: CompletedWork;
  courses: Course[];
  priorities: SelectOption[];
  categories: SelectOption[];
  types: SelectOption[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const descriptionDraft = useRef<DocumentContentJson | null>(null);
  const [name, setName] = useState(item["University/Name"]);
  const [completionDate, setCompletionDate] = useState(item["University/Completion Date"] ?? "");
  const [originalDueDate, setOriginalDueDate] = useState(item["University/Original Due Date"] ?? "");
  const [courseId, setCourseId] = useState(item["University/Course"]?.["fibery/id"] ?? "");
  const [priorityId, setPriorityId] = useState(item["University/Priority"]?.["fibery/id"] ?? "");
  const [categoryId, setCategoryId] = useState(item["University/Category"]?.["fibery/id"] ?? "");
  const [typeId, setTypeId] = useState(item["University/Type"]?.["fibery/id"] ?? "");

  const descriptionQuery = useQuery({
    queryKey: ["completed-description", item["fibery/id"]],
    queryFn: async () => {
      const entity = await getEntityById<{"University/Description": {"Collaboration~Documents/secret": string} | null}>({
        type: "University/Completed Work",
        id: item["fibery/id"],
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
        type: "University/Completed Work",
        id: item["fibery/id"],
        values: {
          "University/Name": name.trim(),
          "University/Completion Date": completionDate || null,
          "University/Original Due Date": originalDueDate || null,
          "University/Course": courseId ? {"fibery/id": courseId} : null,
          "University/Priority": priorityId ? {"fibery/id": priorityId} : null,
          "University/Category": categoryId ? {"fibery/id": categoryId} : null,
          "University/Type": typeId ? {"fibery/id": typeId} : null,
        },
      });
      if (descriptionQuery.data?.secret && descriptionDraft.current) {
        await setDocument({secret: descriptionQuery.data.secret, content: descriptionDraft.current});
        queryClient.setQueryData(["completed-description", item["fibery/id"]], {...descriptionQuery.data, content: descriptionDraft.current});
      }
      return result;
    },
    onSuccess: async () => {await queryClient.invalidateQueries({queryKey: ["completed-work"]}); onClose();},
  });

  const remove = useMutation({
    mutationFn: () => deleteEntity({type: "University/Completed Work", id: item["fibery/id"]}),
    onSuccess: async () => {await queryClient.invalidateQueries({queryKey: ["completed-work"]}); onClose();},
  });

  return (
    <Modal title="Edit completed work" onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => {event.preventDefault(); save.mutate();}}>
        <label className="block space-y-1.5 text-sm font-medium"><span>Name</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-medium"><span>Completed</span><input type="date" value={completionDate} onChange={(event) => setCompletionDate(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
          <label className="block space-y-1.5 text-sm font-medium"><span>Original due date</span><input type="date" value={originalDueDate} onChange={(event) => setOriginalDueDate(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-medium"><span>Type</span><select value={typeId} onChange={(event) => setTypeId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2"><option value="">No type</option>{types.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          <label className="block space-y-1.5 text-sm font-medium"><span>Course</span><select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2"><option value="">No course</option>{courses.map((course) => <option key={course["fibery/id"]} value={course["fibery/id"]}>{course["University/Name"]}</option>)}</select></label>
          <label className="block space-y-1.5 text-sm font-medium"><span>Priority</span><select value={priorityId} onChange={(event) => setPriorityId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2"><option value="">No priority</option>{priorities.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          <label className="block space-y-1.5 text-sm font-medium"><span>Category</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2"><option value="">No category</option>{categories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Description</span>
          {descriptionQuery.isLoading ? <div className="min-h-28 animate-pulse rounded-md bg-muted" /> : descriptionQuery.data ? <div className="min-h-32 cursor-text rounded-md border bg-background p-3"><DescriptionEditor key={item["fibery/id"]} defaultValue={descriptionQuery.data.content} placeholder="Add notes, links, or details…" onChange={(content) => {descriptionDraft.current = content;}} /></div> : <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No description document is available for this record.</p>}
        </div>
        {(save.isError || remove.isError || descriptionQuery.isError) ? <p className="rounded-md border border-destructive p-3 text-xs text-destructive">{friendlyError(save.error ?? remove.error ?? descriptionQuery.error)}</p> : null}
        <div className="flex items-center justify-between border-t pt-4">
          <button type="button" disabled={remove.isPending} onClick={() => {if (window.confirm(`Delete “${item["University/Name"]}” from Completed Work? This cannot be undone.`)) remove.mutate();}} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent disabled:opacity-50"><Trash2 className="size-4" /> Delete</button>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Cancel</button><button type="submit" disabled={save.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{save.isPending ? "Saving…" : "Save changes"}</button></div>
        </div>
      </form>
    </Modal>
  );
}

