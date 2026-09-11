import {useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {createEntity, type SelectOption} from "@/lib/fibery";
import {cn} from "@/lib/cn";
import {friendlyError, type Course, type WorkItem} from "@/dashboard";
import {Modal} from "@/dashboard-components/shared/components";
import {completeWorkItem, type CompletionOptions} from "@/completeWork";

export function QuickAdd({
  courses,
  priorities,
  categories,
  academicYears,
  assignmentStates,
  todoStates,
  completionOptions,
  onClose,
}: {
  courses: Course[];
  priorities: SelectOption[];
  categories: SelectOption[];
  academicYears: SelectOption[];
  assignmentStates: SelectOption[];
  todoStates: SelectOption[];
  completionOptions: CompletionOptions;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"Assignment" | "To-Do" | "Course">("Assignment");
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [courseId, setCourseId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [credits, setCredits] = useState("3");
  const [stateId, setStateId] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required.");
      if (kind === "Assignment") {
        const selectedState = assignmentStates.find((option) => option.id === stateId);
        const completing = selectedState?.name === "Done";
        const created = await createEntity<{"fibery/id": string; "fibery/public-id": string}>({
          type: "University/Assignments",
          values: {
            "University/Name": trimmed,
            ...(dueDate ? {"University/Due Date": dueDate} : {}),
            ...(courseId ? {"University/Course": {"fibery/id": courseId}} : {}),
            ...(optionId ? {"University/Priority": {"fibery/id": optionId}} : {}),
            ...(!completing && stateId ? {"workflow/state": {"fibery/id": stateId}} : {}),
          },
        });
        if (!completing) return created;
        const courseName = courses.find((course) => course["fibery/id"] === courseId)?.["University/Name"] ?? "No course";
        const priorityName = priorities.find((option) => option.id === optionId)?.name ?? "No priority";
        const item: WorkItem = {
          id: created["fibery/id"], publicId: created["fibery/public-id"], type: "Assignment", name: trimmed,
          dueDate: dueDate || null, state: "Not Started", stateId: "", context: courseName, contextId: courseId,
          contextColor: null, contextIcon: null, tag: priorityName, tagId: optionId, tagColor: null, tagIcon: null,
        };
        return completeWorkItem(item, completionOptions);
      }
      if (kind === "To-Do") {
        const selectedState = todoStates.find((option) => option.id === stateId);
        const completing = selectedState?.name === "Done";
        const created = await createEntity<{"fibery/id": string; "fibery/public-id": string}>({
          type: "University/To-Dos",
          values: {
            "University/Name": trimmed,
            ...(dueDate ? {"University/Due Date": dueDate} : {}),
            ...(optionId ? {"University/Category": {"fibery/id": optionId}} : {}),
            ...(!completing && stateId ? {"workflow/state": {"fibery/id": stateId}} : {}),
          },
        });
        if (!completing) return created;
        const categoryName = categories.find((option) => option.id === optionId)?.name ?? "Uncategorized";
        const item: WorkItem = {
          id: created["fibery/id"], publicId: created["fibery/public-id"], type: "To-Do", name: trimmed,
          dueDate: dueDate || null, state: "Not Started", stateId: "", context: categoryName, contextId: optionId,
          contextColor: null, contextIcon: null, tag: categoryName, tagId: optionId, tagColor: null, tagIcon: null,
        };
        return completeWorkItem(item, completionOptions);
      }
      return createEntity({
        type: "University/Courses",
        values: {
          "University/Name": trimmed,
          "University/Credit Hours": Number(credits) || 0,
          ...(optionId ? {"University/Academic Year": {"fibery/id": optionId}} : {}),
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      onClose();
    },
  });

  const options = kind === "Assignment" ? priorities : kind === "To-Do" ? categories : academicYears;

  function switchKind(next: "Assignment" | "To-Do" | "Course") {
    setKind(next);
    setOptionId("");
    setStateId("");
  }

  return (
    <Modal title="Quick add" onClose={onClose}>
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {(["Assignment", "To-Do", "Course"] as const).map((item) => (
          <button key={item} type="button" onClick={() => switchKind(item)} className={cn("rounded-md px-3 py-2 text-xs font-medium", kind === item ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{item}</button>
        ))}
      </div>
      <form className="space-y-4" onSubmit={(event) => {event.preventDefault(); mutation.mutate();}}>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>{kind} name</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder={kind === "Course" ? "e.g. ECE 1004" : "What needs to be done?"} />
        </label>
        {kind !== "Course" ? (
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Due date</span>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>
        ) : (
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Credit hours</span>
            <input type="number" min="0" max="12" value={credits} onChange={(event) => setCredits(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>
        )}
        {kind === "Assignment" ? (
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Course</span>
            <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="">No course</option>
              {courses.map((course) => <option key={course["fibery/id"]} value={course["fibery/id"]}>{course["University/Name"]}</option>)}
            </select>
          </label>
        ) : null}
        {kind !== "Course" ? (
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Status</span>
            <select value={stateId} onChange={(event) => setStateId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="">Default: Not Started</option>
              {(kind === "Assignment" ? assignmentStates : todoStates).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className="block space-y-1.5 text-sm font-medium">
          <span>{kind === "Assignment" ? "Priority" : kind === "To-Do" ? "Category" : "Academic year"}</span>
          <select value={optionId} onChange={(event) => setOptionId(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
            <option value="">Unassigned</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        {mutation.isError ? <p className="rounded-md border border-destructive p-3 text-xs text-destructive">{friendlyError(mutation.error)}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{mutation.isPending ? "Adding…" : `Add ${kind}`}</button>
        </div>
      </form>
    </Modal>
  );
}
