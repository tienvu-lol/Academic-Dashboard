import {useRef, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Trash2} from "lucide-react";
import {DescriptionEditor} from "@/dashboard-components/shared/DescriptionEditor";

import {deleteEntity, getDocument, getEntityById, setDocument, updateEntity, type DocumentContentJson, type SelectOption} from "@/lib/fibery";
import {Modal} from "@/dashboard-components/shared/components";
import {friendlyError, type Assignment, type CompletedWork, type Course, type Todo, type WorkItem} from "@/dashboard";
import {completeWorkItem, type CompletionOptions} from "@/completeWork";

export function TaskEditor({
  item,
  courses,
  priorities,
  categories,
  assignmentStates,
  todoStates,
  completionOptions,
  onClose,
}: {
  item: WorkItem;
  courses: Course[];
  priorities: SelectOption[];
  categories: SelectOption[];
  assignmentStates: SelectOption[];
  todoStates: SelectOption[];
  completionOptions: CompletionOptions;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const descriptionDraft = useRef<DocumentContentJson | null>(null);
  const [name, setName] = useState(item.name);
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const [contextId, setContextId] = useState(item.contextId);
  const [tagId, setTagId] = useState(item.tagId);
  const [stateId, setStateId] = useState(item.stateId);
  const type = item.type === "Assignment" ? "University/Assignments" : "University/To-Dos";
  const states = item.type === "Assignment" ? assignmentStates : todoStates;

  const descriptionQuery = useQuery({
    queryKey: ["task-description", type, item.id],
    queryFn: async () => {
      const entity = await getEntityById<{"University/Description": {"Collaboration~Documents/secret": string} | null}>({
        type,
        id: item.id,
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
      const targetState = states.find((option) => option.id === stateId);
      const completing = targetState?.name === "Done";
      const nextContext = item.type === "Assignment"
        ? courses.find((course) => course["fibery/id"] === contextId)?.["University/Name"] ?? "No course"
        : categories.find((option) => option.id === contextId)?.name ?? "Uncategorized";
      const nextPriority = priorities.find((option) => option.id === tagId)?.name ?? "No priority";
      const nextItem: WorkItem = {
        ...item,
        name: name.trim(),
        dueDate: dueDate || null,
        contextId,
        context: nextContext,
        tagId: item.type === "Assignment" ? tagId : contextId,
        tag: item.type === "Assignment" ? nextPriority : nextContext,
      };
      await updateEntity({
        type,
        id: item.id,
        values: item.type === "Assignment" ? {
          "University/Name": name.trim(),
          "University/Due Date": dueDate || null,
          "University/Course": contextId ? {"fibery/id": contextId} : null,
          "University/Priority": tagId ? {"fibery/id": tagId} : null,
          ...(!completing && stateId ? {"workflow/state": {"fibery/id": stateId}} : {}),
        } : {
          "University/Name": name.trim(),
          "University/Due Date": dueDate || null,
          "University/Category": contextId ? {"fibery/id": contextId} : null,
          ...(!completing && stateId ? {"workflow/state": {"fibery/id": stateId}} : {}),
        },
      });
      if (descriptionQuery.data?.secret && descriptionDraft.current) {
        await setDocument({secret: descriptionQuery.data.secret, content: descriptionDraft.current});
        queryClient.setQueryData(["task-description", type, item.id], {...descriptionQuery.data, content: descriptionDraft.current});
      }
      if (completing) return {completed: true as const, archive: await completeWorkItem(nextItem, completionOptions)};
      return {completed: false as const, archive: null};
    },
    onSuccess: async (result) => {
      const sourceKey = item.type === "Assignment" ? "assignments" : "todos";
      if (result.completed) {
        if (item.type === "Assignment") queryClient.setQueryData<Assignment[]>(["assignments"], (current) => current?.filter((entry) => entry["fibery/id"] !== item.id) ?? []);
        else queryClient.setQueryData<Todo[]>(["todos"], (current) => current?.filter((entry) => entry["fibery/id"] !== item.id) ?? []);
        queryClient.setQueryData<CompletedWork[]>(["completed-work"], (current) => [result.archive, ...(current ?? []).filter((entry) => entry["fibery/id"] !== result.archive["fibery/id"])]);
      }
      await Promise.all([
        queryClient.refetchQueries({queryKey: [sourceKey], exact: true}),
        queryClient.refetchQueries({queryKey: ["completed-work"], exact: true}),
      ]);
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteEntity({type, id: item.id}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: [item.type === "Assignment" ? "assignments" : "todos"]});
      onClose();
    },
  });

  return (
    <Modal title={`Edit ${item.type}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => {event.preventDefault(); save.mutate();}}>
        <label className="block space-y-1.5 text-sm font-medium"><span>Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-medium"><span>Due date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
          <label className="block space-y-1.5 text-sm font-medium"><span>Status</span><select value={stateId} onChange={(event) => setStateId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring">{states.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        </div>
        {item.type === "Assignment" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-medium"><span>Course</span><select value={contextId} onChange={(event) => setContextId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"><option value="">No course</option>{courses.map((course) => <option key={course["fibery/id"]} value={course["fibery/id"]}>{course["University/Name"]}</option>)}</select></label>
            <label className="block space-y-1.5 text-sm font-medium"><span>Priority</span><select value={tagId} onChange={(event) => setTagId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"><option value="">No priority</option>{priorities.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          </div>
        ) : (
          <label className="block space-y-1.5 text-sm font-medium"><span>Category</span><select value={contextId} onChange={(event) => setContextId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"><option value="">Uncategorized</option>{categories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        )}
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Description</span>
          {descriptionQuery.isLoading ? <div className="min-h-28 animate-pulse rounded-md bg-muted" /> : descriptionQuery.data ? (
            <div className="min-h-32 cursor-text rounded-md border bg-background p-3">
              <DescriptionEditor key={item.id} defaultValue={descriptionQuery.data.content} placeholder="Add notes, links, or details…" onChange={(content) => {descriptionDraft.current = content;}} />
            </div>
          ) : <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No description document is available for this item.</p>}
        </div>
        {(save.isError || remove.isError || descriptionQuery.isError) ? <p className="rounded-md border border-destructive p-3 text-xs text-destructive">{friendlyError(save.error ?? remove.error ?? descriptionQuery.error)}</p> : null}
        <div className="flex items-center justify-between border-t pt-4">
          <button type="button" disabled={remove.isPending} onClick={() => {if (window.confirm(`Delete “${item.name}”? This cannot be undone.`)) remove.mutate();}} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent disabled:opacity-50"><Trash2 className="size-4" /> Delete</button>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Cancel</button><button type="submit" disabled={save.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{save.isPending ? (states.find((option) => option.id === stateId)?.name === "Done" ? "Completing…" : "Saving…") : "Save changes"}</button></div>
        </div>
      </form>
    </Modal>
  );
}

