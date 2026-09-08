import {useMemo, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {addMonths, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths} from "date-fns";
import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {AlertTriangle, BookOpen, CalendarCheck2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, Layers3, ListTodo, Pencil, Plus, RefreshCcw, Settings2, Sparkles, Users} from "lucide-react";
import {getSchema, getSingleSelectOptions, getWorkflowStates, openEntity, queryEntities, updateEntity} from "@/lib/fibery";
import {cn} from "@/lib/cn";
import {ChartTooltip, DataBadge, MetricCard, SectionTitle, Toggle} from "@/components";
import {CompletedEditor} from "@/CompletedEditor";
import {CourseEditor} from "@/CourseEditor";
import {DailyQuote} from "@/DailyQuote";
import {NotesPanel} from "@/NotesPanel";
import {QuickAdd} from "@/QuickAdd";
import {SettingsPanel} from "@/SettingsPanel";
import {TaskEditor} from "@/TaskEditor";
import {completeWorkItem, type CompletionOptions} from "@/completeWork";
import {DEFAULT_PREFS, PREF_KEY, dateKey, friendlyError, heatTone, isDone, readPreferences, sourceTone, stateTone, type Assignment, type CalendarEvent, type CompletedWork, type Course, type Preferences, type Todo, type WorkItem} from "@/dashboard";

type QueueView = "Today" | "Selected" | "Upcoming" | "All" | "Completed";
type CalendarEntry = CalendarEvent & {calendarType: "Google Calendar/Event" | "Google Calendar/All Day Event"};
type CalendarWorkPreview =
  | {kind: "active"; item: WorkItem}
  | {kind: "completed"; item: CompletedWork};

const SOCIAL_WORDS = /\b(?:meeting|meetup|social|event|club|lunch|dinner|coffee|hangout|gathering|appointment|conference|networking|call)\b/i;

function isAssessmentName(name: string) {
  return /\b(?:quiz(?:zes)?|tests?|exams?|midterms?|mid-terms?|finals?)(?:\b|\d)/i.test(name);
}

function isSocialWorkItem(item: WorkItem) {
  if (item.type !== "To-Do") return false;
  return /(?:event\s*\/\s*social|social\s*\/\s*event)/i.test(item.context) || SOCIAL_WORDS.test(item.name);
}

function courseSourceTag(courseName: string | null | undefined): string | null {
  const normalized = courseName?.trim();
  if (!normalized || normalized.toLowerCase() === "no course") return null;
  const courseCode = normalized.match(/^([A-Za-z]{2,6})(?=\s+\d{3,4}\b)/);
  if (courseCode) return courseCode[1].toUpperCase();
  const existingAcronym = normalized.match(/(?:^|[\s/(&-])([A-Z]{2,6})(?=$|[\s/)&-])/);
  if (existingAcronym) return existingAcronym[1];
  const initials = normalized.match(/[A-Za-z]+/g)?.slice(0, 4).map((word) => word[0]).join("");
  return initials?.toUpperCase() || null;
}

function calendarWorkPreviews(tasks: WorkItem[], completedAssignments: CompletedWork[]): CalendarWorkPreview[] {
  const prioritizedTasks = [...tasks].sort((left, right) => {
    const socialDifference = Number(isSocialWorkItem(right)) - Number(isSocialWorkItem(left));
    if (socialDifference) return socialDifference;
    return Number(isAssessmentName(right.name)) - Number(isAssessmentName(left.name));
  });
  const activeLimit = completedAssignments.length ? 2 : 3;
  return [
    ...prioritizedTasks.slice(0, activeLimit).map((item) => ({kind: "active" as const, item})),
    ...completedAssignments.slice(0, 3 - Math.min(activeLimit, prioritizedTasks.length)).map((item) => ({kind: "completed" as const, item})),
  ];
}

function workRowTone(name: string, dueDate: string | null, todayKey: string) {
  const assessment = isAssessmentName(name);
  const daysUntilDue = dueDate ? differenceInCalendarDays(parseISO(dueDate), parseISO(todayKey)) : null;
  if (daysUntilDue !== null && daysUntilDue < 0) return "bg-destructive text-white border-2 border-destructive ring-2 ring-destructive shadow-lg";
  if (assessment && daysUntilDue !== null && daysUntilDue <= 2) return "highlight-violet border-2 border-yellow";
  if (assessment) return "highlight-violet border-violet";
  if (daysUntilDue !== null && daysUntilDue <= 2) return "highlight-yellow border-yellow";
  return "";
}

function assignmentDueBadge(dueDate: string | null, todayKey: string) {
  if (!dueDate) return {label: "No due date", tone: "highlight-grey"};
  const days = differenceInCalendarDays(parseISO(dueDate), parseISO(todayKey));
  if (days < 0) return {label: `${Math.abs(days)}d overdue`, tone: "highlight-red"};
  if (days === 0) return {label: "Due today", tone: "highlight-red"};
  if (days <= 2) return {label: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "highlight-yellow"};
  if (days <= 7) return {label: `Due in ${days} days`, tone: "highlight-blue"};
  return {label: `Due in ${days} days`, tone: "highlight-grey"};
}

export default function App() {
  const queryClient = useQueryClient();
  const today = new Date();
  const todayKey = dateKey(today);
  const [month, setMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [queueView, setQueueView] = useState<QueueView>("Today");
  const [sourceFilter, setSourceFilter] = useState<"All" | "Assignment" | "To-Do">("All");
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkItem | null>(null);
  const [editingCompleted, setEditingCompleted] = useState<CompletedWork | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);

  function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => {
      const next = {...current, [key]: value};
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
      return next;
    });
  }

  const assignmentsQuery = useQuery({
    queryKey: ["assignments"],
    enabled: preferences.showAssignments,
    queryFn: () => queryEntities<Assignment>({
      type: "University/Assignments",
      fields: ["fibery/id", "fibery/public-id", "University/Name", "University/Due Date", "University/Days Left", {"University/Course": ["fibery/id", "University/Name"]}, {"University/Priority": ["fibery/id", "enum/name", "enum/color", "enum/icon"]}, {"workflow/state": ["fibery/id", "enum/name"]}],
      orderBy: {field: "University/Due Date", direction: "asc"},
      limit: 1000,
    }),
  });
  const todosQuery = useQuery({
    queryKey: ["todos"],
    enabled: preferences.showTodos,
    queryFn: () => queryEntities<Todo>({
      type: "University/To-Dos",
      fields: ["fibery/id", "fibery/public-id", "University/Name", "University/Due Date", "University/Days Left", {"University/Category": ["fibery/id", "enum/name", "enum/color", "enum/icon"]}, {"workflow/state": ["fibery/id", "enum/name"]}],
      orderBy: {field: "University/Due Date", direction: "asc"},
      limit: 1000,
    }),
  });
  const coursesQuery = useQuery({
    queryKey: ["courses"],
    queryFn: () => queryEntities<Course>({
      type: "University/Courses",
      fields: ["fibery/id", "fibery/public-id", "University/Name", "University/Credit Hours", {"University/Academic Year": ["fibery/id", "enum/name", "enum/color", "enum/icon"]}],
      orderBy: {field: "University/Name", direction: "asc"},
      limit: 500,
    }),
  });
  const completedQuery = useQuery({
    queryKey: ["completed-work"],
    queryFn: () => queryEntities<CompletedWork>({
      type: "University/Completed Work",
      fields: ["fibery/id", "fibery/public-id", "University/Name", "University/Completion Date", "University/Original Due Date", {"University/Course": ["fibery/id", "University/Name"]}, {"University/Category": ["fibery/id", "enum/name", "enum/color", "enum/icon"]}, {"University/Priority": ["fibery/id", "enum/name", "enum/color", "enum/icon"]}, {"University/Type": ["fibery/id", "enum/name", "enum/color", "enum/icon"]}],
      orderBy: {field: "University/Completion Date", direction: "desc"},
      limit: 1500,
    }),
    refetchInterval: 10000,
    refetchOnWindowFocus: "always",
  });
  const eventsQuery = useQuery({
    queryKey: ["google-calendar-events"],
    enabled: preferences.showCalendar,
    queryFn: () => queryEntities<CalendarEvent>({type: "Google Calendar/Event", fields: ["fibery/id", "fibery/public-id", "Google Calendar/Name", "Google Calendar/Dates", "Google Calendar/Location"], orderBy: {field: "Google Calendar/Dates", direction: "asc"}, limit: 1000}),
  });
  const allDayEventsQuery = useQuery({
    queryKey: ["google-calendar-all-day-events"],
    enabled: preferences.showCalendar,
    queryFn: () => queryEntities<CalendarEvent>({type: "Google Calendar/All Day Event", fields: ["fibery/id", "fibery/public-id", "Google Calendar/Name", "Google Calendar/Dates", "Google Calendar/Location"], orderBy: {field: "Google Calendar/Dates", direction: "asc"}, limit: 1000}),
  });

  const prioritiesQuery = useQuery({queryKey: ["assignment-priorities"], queryFn: () => getSingleSelectOptions({type: "University/Assignments", field: "University/Priority"})});
  const categoriesQuery = useQuery({queryKey: ["todo-categories"], queryFn: () => getSingleSelectOptions({type: "University/To-Dos", field: "University/Category"})});
  const completedPrioritiesQuery = useQuery({queryKey: ["completed-priorities"], queryFn: () => getSingleSelectOptions({type: "University/Completed Work", field: "University/Priority"})});
  const completedCategoriesQuery = useQuery({queryKey: ["completed-categories"], queryFn: () => getSingleSelectOptions({type: "University/Completed Work", field: "University/Category"})});
  const completedTypesQuery = useQuery({queryKey: ["completed-types"], queryFn: () => getSingleSelectOptions({type: "University/Completed Work", field: "University/Type"})});
  const academicYearsQuery = useQuery({queryKey: ["academic-years"], queryFn: () => getSingleSelectOptions({type: "University/Courses", field: "University/Academic Year"})});
  const assignmentStatesQuery = useQuery({queryKey: ["assignment-states"], queryFn: () => getWorkflowStates({type: "University/Assignments"})});
  const todoStatesQuery = useQuery({queryKey: ["todo-states"], queryFn: () => getWorkflowStates({type: "University/To-Dos"})});
  const paintsQuery = useQuery({
    queryKey: ["workspace-paints"],
    queryFn: async () => {
      const schema = await getSchema();
      return {courseColor: schema.getTypeObjectByName("University/Courses")?.color ?? null};
    },
  });

  const assignments = preferences.showAssignments ? assignmentsQuery.data ?? [] : [];
  const todos = preferences.showTodos ? todosQuery.data ?? [] : [];
  const courses = coursesQuery.data ?? [];
  const completed = completedQuery.data ?? [];
  const assignmentStates = assignmentStatesQuery.data ?? [];
  const todoStates = todoStatesQuery.data ?? [];

  const allWork = useMemo<WorkItem[]>(() => [
    ...assignments.map((item) => ({
      id: item["fibery/id"], publicId: item["fibery/public-id"], type: "Assignment" as const,
      name: item["University/Name"], dueDate: item["University/Due Date"],
      state: item["workflow/state"]?.["enum/name"] ?? "Not Started", stateId: item["workflow/state"]?.["fibery/id"] ?? "",
      context: item["University/Course"]?.["University/Name"] ?? "No course", contextId: item["University/Course"]?.["fibery/id"] ?? "",
      contextColor: paintsQuery.data?.courseColor ?? null, contextIcon: null,
      tag: item["University/Priority"]?.["enum/name"] ?? "No priority", tagId: item["University/Priority"]?.["fibery/id"] ?? "",
      tagColor: item["University/Priority"]?.["enum/color"] ?? null, tagIcon: item["University/Priority"]?.["enum/icon"] ?? null,
    })),
    ...todos.map((item) => ({
      id: item["fibery/id"], publicId: item["fibery/public-id"], type: "To-Do" as const,
      name: item["University/Name"], dueDate: item["University/Due Date"],
      state: item["workflow/state"]?.["enum/name"] ?? "Not Started", stateId: item["workflow/state"]?.["fibery/id"] ?? "",
      context: item["University/Category"]?.["enum/name"] ?? "Uncategorized", contextId: item["University/Category"]?.["fibery/id"] ?? "",
      contextColor: item["University/Category"]?.["enum/color"] ?? null, contextIcon: item["University/Category"]?.["enum/icon"] ?? null,
      tag: item["University/Category"]?.["enum/name"] ?? "Uncategorized", tagId: item["University/Category"]?.["fibery/id"] ?? "",
      tagColor: item["University/Category"]?.["enum/color"] ?? null, tagIcon: item["University/Category"]?.["enum/icon"] ?? null,
    })),
  ].sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31")), [assignments, todos, paintsQuery.data?.courseColor]);

  const activeWork = allWork.filter((item) => !isDone(item.state));
  const dueToday = activeWork.filter((item) => item.dueDate === todayKey);
  const overdue = activeWork.filter((item) => item.dueDate && item.dueDate < todayKey);
  const completedToday = completed.filter((item) => item["University/Completion Date"] === todayKey);
  const totalCredits = courses.reduce((sum, course) => sum + (course["University/Credit Hours"] ?? 0), 0);
  const selectedKey = dateKey(selectedDate);

  const queueItems = allWork.filter((item) => {
    if (sourceFilter !== "All" && item.type !== sourceFilter) return false;
    if (queueView === "Today") return !isDone(item.state) && (!item.dueDate || item.dueDate <= todayKey);
    if (queueView === "Selected") return item.dueDate === selectedKey;
    if (queueView === "Upcoming") return !isDone(item.state) && Boolean(item.dueDate && item.dueDate > todayKey);
    if (queueView === "Completed") return false;
    return true;
  });
  const archivedQueueItems = completed.filter((item) => {
    const type = item["University/Type"]?.["enum/name"];
    return sourceFilter === "All" || type === sourceFilter;
  });
  const shownCount = queueView === "Completed" ? archivedQueueItems.length : queueItems.length;

  const calendarDays = useMemo(() => {
    const weekStartsOn = preferences.mondayFirst ? 1 : 0;
    return eachDayOfInterval({start: startOfWeek(startOfMonth(month), {weekStartsOn}), end: endOfWeek(endOfMonth(month), {weekStartsOn})});
  }, [month, preferences.mondayFirst]);

  const workCounts = useMemo(() => {
    const result = new Map<string, {assignments: number; todos: number; total: number}>();
    for (const item of activeWork) {
      if (!item.dueDate) continue;
      const current = result.get(item.dueDate) ?? {assignments: 0, todos: 0, total: 0};
      if (item.type === "Assignment") current.assignments += 1;
      else current.todos += 1;
      current.total += 1;
      result.set(item.dueDate, current);
    }
    return result;
  }, [activeWork]);

  const workByDay = useMemo(() => {
    const result = new Map<string, WorkItem[]>();
    for (const item of activeWork) {
      if (!item.dueDate) continue;
      result.set(item.dueDate, [...(result.get(item.dueDate) ?? []), item]);
    }
    return result;
  }, [activeWork]);

  const completedAssignmentsByDay = useMemo(() => {
    const result = new Map<string, CompletedWork[]>();
    if (!preferences.showAssignments) return result;
    for (const item of completed) {
      if (item["University/Type"]?.["enum/name"] !== "Assignment") continue;
      const key = item["University/Original Due Date"] ?? item["University/Completion Date"];
      if (!key) continue;
      result.set(key, [...(result.get(key) ?? []), item]);
    }
    return result;
  }, [completed, preferences.showAssignments]);

  const calendarEntries = useMemo<CalendarEntry[]>(() => preferences.showCalendar ? [
    ...(eventsQuery.data ?? []).map((event) => ({...event, calendarType: "Google Calendar/Event" as const})),
    ...(allDayEventsQuery.data ?? []).map((event) => ({...event, calendarType: "Google Calendar/All Day Event" as const})),
  ] : [], [eventsQuery.data, allDayEventsQuery.data, preferences.showCalendar]);

  const eventsByDay = useMemo(() => {
    const result = new Map<string, CalendarEntry[]>();
    for (const day of calendarDays) {
      const key = dateKey(day);
      const matches = calendarEntries.filter((event) => {
        const range = event["Google Calendar/Dates"];
        if (!range) return false;
        const start = dateKey(range.start);
        const end = dateKey(range.end);
        return event.calendarType === "Google Calendar/Event" ? start <= key && end >= key : start <= key && end > key;
      });
      if (matches.length) result.set(key, matches.sort((a, b) => (a["Google Calendar/Dates"]?.start ?? "").localeCompare(b["Google Calendar/Dates"]?.start ?? "")));
    }
    return result;
  }, [calendarDays, calendarEntries]);

  const maxMonthLoad = Math.max(1, ...calendarDays.filter((day) => isSameMonth(day, month)).map((day) => {
    const key = dateKey(day);
    return (workCounts.get(key)?.total ?? 0) + (completedAssignmentsByDay.get(key)?.length ?? 0);
  }));
  const maxCalendarLoad = Math.max(1, ...calendarDays.filter((day) => isSameMonth(day, month)).map((day) => eventsByDay.get(dateKey(day))?.length ?? 0));

  const completionChart = useMemo(() => {
    const counts = new Map<string, number>();
    completed.forEach((item) => {const key = item["University/Completion Date"]; if (key) counts.set(key, (counts.get(key) ?? 0) + 1);});
    return eachDayOfInterval({start: startOfMonth(month), end: endOfMonth(month)}).map((day) => ({label: format(day, "MMM d"), completed: counts.get(dateKey(day)) ?? 0}));
  }, [completed, month]);
  const monthCompleted = completionChart.reduce((sum, item) => sum + item.completed, 0);

  const courseGroups = useMemo(() => {
    const optionNames = (academicYearsQuery.data ?? []).map((option) => option.name);
    const unassigned = optionNames.find((name) => name.toLowerCase() === "unassigned") ?? "Unassigned";
    const groupNames = optionNames.includes(unassigned) ? optionNames : [...optionNames, unassigned];
    return groupNames.map((name) => ({name, courses: courses.filter((course) => (course["University/Academic Year"]?.["enum/name"] ?? unassigned) === name)}));
  }, [academicYearsQuery.data, courses]);

  const completionOptions: CompletionOptions = {
    types: completedTypesQuery.data ?? [],
    priorities: completedPrioritiesQuery.data ?? [],
    categories: completedCategoriesQuery.data ?? [],
  };

  const statusMutation = useMutation({
    mutationFn: async ({item, stateId}: {item: WorkItem; stateId: string}) => {
      const states = item.type === "Assignment" ? assignmentStates : todoStates;
      const target = states.find((state) => state.id === stateId);
      if (!target) throw new Error("That status is no longer available. Refresh and try again.");
      if (target.name === "Done") {
        const archive = await completeWorkItem(item, completionOptions);
        return {completed: true as const, archive};
      }
      await updateEntity({type: item.type === "Assignment" ? "University/Assignments" : "University/To-Dos", id: item.id, values: {"workflow/state": {"fibery/id": stateId}}});
      return {completed: false as const, archive: null};
    },
    onSuccess: async (result, variables) => {
      const sourceKey = variables.item.type === "Assignment" ? "assignments" : "todos";
      if (result.completed) {
        if (variables.item.type === "Assignment") queryClient.setQueryData<Assignment[]>(["assignments"], (current) => current?.filter((item) => item["fibery/id"] !== variables.item.id) ?? []);
        else queryClient.setQueryData<Todo[]>(["todos"], (current) => current?.filter((item) => item["fibery/id"] !== variables.item.id) ?? []);
        queryClient.setQueryData<CompletedWork[]>(["completed-work"], (current) => [result.archive, ...(current ?? []).filter((item) => item["fibery/id"] !== result.archive["fibery/id"])]);
      }
      await Promise.all([
        queryClient.refetchQueries({queryKey: [sourceKey], exact: true}),
        queryClient.refetchQueries({queryKey: ["completed-work"], exact: true}),
      ]);
    },
  });
  const yearMutation = useMutation({
    mutationFn: ({id, optionId}: {id: string; optionId: string}) => updateEntity({type: "University/Courses", id, values: {"University/Academic Year": optionId ? {"fibery/id": optionId} : null}}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ["courses"]}),
  });

  const loading = assignmentsQuery.isLoading || todosQuery.isLoading || coursesQuery.isLoading || completedQuery.isLoading;
  const errors = [assignmentsQuery.error, todosQuery.error, coursesQuery.error, completedQuery.error, eventsQuery.error, allDayEventsQuery.error, assignmentStatesQuery.error, todoStatesQuery.error, completedPrioritiesQuery.error, completedCategoriesQuery.error, completedTypesQuery.error, paintsQuery.error, statusMutation.error].filter(Boolean);
  const weekdayLabels = preferences.mondayFirst ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const queueTabs: QueueView[] = ["Today", "Upcoming", "All", "Completed", "Selected"];

  function changeMonth(next: Date) {setMonth(startOfMonth(next)); setSelectedDate(startOfMonth(next));}
  function selectCalendarDay(day: Date) {setSelectedDate(day); setQueueView("Selected"); if (!isSameMonth(day, month)) setMonth(startOfMonth(day));}

  return (
    <main className={cn("min-h-screen bg-background text-foreground", preferences.compact ? "text-[13px]" : "text-sm")}>
      <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl highlight-aqua"><Sparkles className="size-5" /></span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Academic dashboard</div>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">Good {today.getHours() < 12 ? "morning" : today.getHours() < 18 ? "afternoon" : "evening"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{format(today, "EEEE, MMMM d")} · Plan, edit, and finish work without leaving this dashboard.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => queryClient.invalidateQueries()} className="grid size-10 place-items-center rounded-md border bg-card text-muted-foreground hover:bg-accent" aria-label="Refresh"><RefreshCcw className={cn("size-4", loading && "animate-spin")} /></button>
            <button type="button" onClick={() => setShowSettings(true)} className="grid size-10 place-items-center rounded-md border bg-card text-muted-foreground hover:bg-accent" aria-label="Settings"><Settings2 className="size-4" /></button>
            <button type="button" onClick={() => setShowQuickAdd(true)} className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-foreground"><Plus className="size-4" /> Add item</button>
          </div>
        </header>

        {errors.length ? <div className="mb-5 rounded-lg border border-destructive bg-card p-4 text-destructive"><p className="font-semibold">Some data could not load.</p>{errors.map((error, index) => <p key={index} className="mt-1 break-words text-xs">{friendlyError(error)}</p>)}</div> : null}

        <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)]">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard icon={<CalendarCheck2 className="size-4" />} label="Due today" value={dueToday.length} detail={dueToday.length ? "Items due now" : "Clear today"} tone="highlight-yellow" />
            <MetricCard icon={<Layers3 className="size-4" />} label="Open workload" value={activeWork.length} detail={`${overdue.length} overdue`} tone="highlight-pink" />
            <MetricCard icon={<CheckCircle2 className="size-4" />} label="Completed today" value={completedToday.length} detail={`${monthCompleted} this month`} tone="highlight-green" />
            <MetricCard icon={<GraduationCap className="size-4" />} label="Total credits" value={totalCredits} detail={`${courses.length} courses`} tone="highlight-blue" />
          </div>
          <NotesPanel />
        </section>

        <section className="mb-5 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SectionTitle icon={<ListTodo className="size-4" />} title="Work queue" detail="Assignments and to-dos together—update status or open any item to edit every field" />
            <button type="button" onClick={() => setShowQuickAdd(true)} className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-accent"><Plus className="size-3.5" /> Add work</button>
          </div>
          <div className="mb-3 flex flex-col gap-2 border-b pb-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {queueTabs.map((tab) => <button key={tab} type="button" onClick={() => setQueueView(tab)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium", queueView === tab ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{tab === "Selected" ? format(selectedDate, "MMM d") : tab}</button>)}
            </div>
            <div className="flex gap-1">{(["All", "Assignment", "To-Do"] as const).map((source) => <button key={source} type="button" onClick={() => setSourceFilter(source)} className={cn("rounded-full border px-3 py-1 text-[11px] font-medium", sourceFilter === source ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{source === "All" ? "All sources" : source}</button>)}</div>
          </div>
          <div>
            <div className="space-y-2">
              {queueView !== "Completed" ? queueItems.map((item) => {
                const states = item.type === "Assignment" ? assignmentStates : todoStates;
                const rowTone = workRowTone(item.name, item.dueDate, todayKey);
                const assessment = isAssessmentName(item.name);
                const itemIsOverdue = Boolean(item.dueDate && item.dueDate < todayKey && !isDone(item.state));
                const dueBadge = item.type === "Assignment" ? assignmentDueBadge(item.dueDate, todayKey) : null;
                return <div key={`${item.type}-${item.id}`} className={cn("flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-center", rowTone || "hover:bg-muted/40")}>
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", sourceTone(item.type))}>{item.type === "Assignment" ? <BookOpen className="size-4" /> : <ListTodo className="size-4" />}</span>
                  <button type="button" onClick={() => setEditingTask(item)} className="min-w-0 flex-1 text-left"><span className="flex flex-wrap items-center gap-2"><span className="min-w-0 truncate font-medium hover:underline">{item.name}</span>{itemIsOverdue ? <span className="inline-flex shrink-0 items-center gap-1 rounded-md border-2 border-current px-2 py-0.5 text-[10px] font-black tracking-wide"><AlertTriangle className="size-3" /> OVERDUE</span> : null}</span><span className={cn("mt-1 flex flex-wrap items-center gap-1.5 text-xs", !rowTone && "text-muted-foreground")}><span>{item.type}</span>{assessment ? <span className="rounded-md border border-current px-2 py-0.5 text-[11px] font-semibold">Assessment</span> : null}{item.contextId ? <DataBadge label={item.context} color={item.contextColor} /> : null}{item.type === "Assignment" && item.tagId ? <DataBadge label={item.tag} color={item.tagColor} /> : null}</span></button>
                  {dueBadge ? <span title={item.dueDate ? `Due ${format(parseISO(item.dueDate), "MMM d")}` : "No due date"} className={cn("shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-semibold", dueBadge.tone)}>{dueBadge.label}</span> : <span className={cn("shrink-0 text-xs", !rowTone && (item.dueDate && item.dueDate < todayKey && !isDone(item.state) ? "font-semibold text-red" : "text-muted-foreground"))}>{item.dueDate ? format(parseISO(item.dueDate), "MMM d") : "No due date"}</span>}
                  <select disabled={statusMutation.isPending && statusMutation.variables?.item.id === item.id} value={item.stateId} onChange={(event) => statusMutation.mutate({item, stateId: event.target.value})} className={cn("min-w-30 rounded-md border px-2 py-1.5 text-xs font-medium outline-none disabled:opacity-60", stateTone(item.state))}>{states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select>
                  <button type="button" onClick={() => setEditingTask(item)} className={cn("rounded-md border p-2", rowTone ? "hover:bg-background/20" : "text-muted-foreground hover:bg-accent")} aria-label={`Edit ${item.name}`}><Pencil className="size-3.5" /></button>
                </div>;
              }) : archivedQueueItems.map((item) => {
                const type = item["University/Type"]?.["enum/name"] ?? "Completed work";
                const isAssignment = type === "Assignment";
                const context = isAssignment ? item["University/Course"]?.["University/Name"] : item["University/Category"]?.["enum/name"];
                const contextColor = isAssignment ? paintsQuery.data?.courseColor : item["University/Category"]?.["enum/color"];
                const priority = item["University/Priority"];
                const assessment = isAssessmentName(item["University/Name"]);
                return <div key={`completed-${item["fibery/id"]}`} className={cn("flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-center", assessment ? "highlight-violet border-violet" : "hover:bg-muted/40")}>
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", sourceTone(type))}>{isAssignment ? <BookOpen className="size-4" /> : <ListTodo className="size-4" />}</span>
                  <button type="button" onClick={() => setEditingCompleted(item)} className="min-w-0 flex-1 text-left"><span className="block truncate font-medium hover:underline">{item["University/Name"]}</span><span className={cn("mt-1 flex flex-wrap items-center gap-1.5 text-xs", !assessment && "text-muted-foreground")}><span>{type}</span>{assessment ? <span className="rounded-md border border-current px-2 py-0.5 text-[11px] font-semibold">Assessment</span> : null}{context ? <DataBadge label={context} color={contextColor} /> : null}{isAssignment && priority ? <DataBadge label={priority["enum/name"]} color={priority["enum/color"]} /> : null}</span></button>
                  <span className={cn("shrink-0 text-xs", !assessment && "text-muted-foreground")}>{item["University/Completion Date"] ? `Completed ${format(parseISO(item["University/Completion Date"]!), "MMM d")}` : "Completion date not set"}</span>
                  <span className="shrink-0 rounded-md border px-2 py-1.5 text-xs font-medium highlight-green">Done</span>
                  <button type="button" onClick={() => setEditingCompleted(item)} className="rounded-md border p-2 text-muted-foreground hover:bg-accent" aria-label={`Edit ${item["University/Name"]}`}><Pencil className="size-3.5" /></button>
                </div>;
              })}
              {!shownCount ? <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">No items in this view.</div> : null}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{shownCount} items shown · {queueView === "Completed" ? "Completed uses the archive database, so deleted originals stay visible here." : "“Today” includes overdue and undated work so nothing actionable disappears."}</p>
        </section>

        <section className="mb-5 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle icon={<CalendarDays className="size-4" />} title="Linked workload calendar" detail={preferences.showCalendar ? "Blue heat = synced Google Calendar event volume" : "Pink = open due work · green = completed assignments"} />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-1.5"><span className="text-xs font-medium">Google Calendar</span><Toggle checked={preferences.showCalendar} onChange={() => updatePreference("showCalendar", !preferences.showCalendar)} label="Show Google Calendar events" /></div>
              <div className="flex items-center gap-1"><button type="button" onClick={() => changeMonth(subMonths(month, 1))} className="rounded-md border p-2 text-muted-foreground hover:bg-accent"><ChevronLeft className="size-4" /></button><button type="button" onClick={() => {setMonth(startOfMonth(today)); setSelectedDate(today); setQueueView("Today");}} className="min-w-32 rounded-md px-3 py-2 font-semibold hover:bg-accent">{format(month, "MMMM yyyy")}</button><button type="button" onClick={() => changeMonth(addMonths(month, 1))} className="rounded-md border p-2 text-muted-foreground hover:bg-accent"><ChevronRight className="size-4" /></button></div>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekdayLabels.map((day, index) => <div key={day} className={cn("rounded-md bg-muted py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground", (preferences.mondayFirst ? index >= 5 : index === 0 || index === 6) && "highlight-aqua")}>{day}</div>)}
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const count = workCounts.get(key) ?? {assignments: 0, todos: 0, total: 0};
              const tasks = workByDay.get(key) ?? [];
              const completedAssignments = completedAssignmentsByDay.get(key) ?? [];
              const workloadTotal = count.total + completedAssignments.length;
              const workPreviews = calendarWorkPreviews(tasks, completedAssignments);
              const events = eventsByDay.get(key) ?? [];
              const heatValue = preferences.showCalendar ? events.length : workloadTotal;
              const heatMaximum = preferences.showCalendar ? maxCalendarLoad : maxMonthLoad;
              const level = heatValue ? Math.max(1, Math.ceil((heatValue / heatMaximum) * 5)) : 0;
              const weekend = day.getDay() === 0 || day.getDay() === 6;
              const hiddenWorkCount = Math.max(0, workloadTotal - workPreviews.length);
              const footerLabel = count.total ? `${count.total} due` : completedAssignments.length ? `${completedAssignments.length} done` : weekend ? "Weekend" : "";
              const breakdown = [count.assignments ? `${count.assignments}A` : "", count.todos ? `${count.todos}T` : "", completedAssignments.length ? `${completedAssignments.length}✓` : ""].filter(Boolean).join(" · ");
              return <div key={key} onClick={() => selectCalendarDay(day)} className={cn("relative flex min-h-40 cursor-pointer flex-col overflow-hidden rounded-lg border bg-card p-2 transition hover:-translate-y-0.5 hover:shadow-sm", !isSameMonth(day, month) && "opacity-35", weekend && "border-aqua", isSameDay(day, selectedDate) && "ring-2 ring-ring")}>
                {preferences.showCalendar ? <span className={cn("pointer-events-none absolute inset-0", heatTone(level, "calendar"))} /> : <div className="pointer-events-none absolute inset-0 flex">{count.total ? <span className={heatTone(level, "work")} style={{flex: count.total}} /> : null}{completedAssignments.length ? <span className={heatTone(level, "completed")} style={{flex: completedAssignments.length}} /> : null}</div>}
                <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                  <div className="mb-1.5 flex items-center justify-between"><span className={cn("grid size-6 place-items-center rounded-full text-xs font-medium", isToday(day) && "bg-primary text-primary-foreground")}>{format(day, "d")}</span>{preferences.showCalendar && events.length ? <span className="text-[9px] font-medium text-blue">{events.length} event{events.length === 1 ? "" : "s"}</span> : null}</div>
                  {preferences.showCalendar ? <div className="space-y-1">{events.slice(0, 3).map((event) => {
                    const start = event["Google Calendar/Dates"]?.start;
                    const time = event.calendarType === "Google Calendar/Event" && start ? format(parseISO(start), "h:mm") : "All day";
                    return <button key={`${event.calendarType}-${event["fibery/id"]}`} type="button" onClick={(click) => {click.stopPropagation(); openEntity({type: event.calendarType, publicId: event["fibery/public-id"]});}} className="block w-full truncate rounded px-1.5 py-1 text-left text-[9px] font-medium highlight-blue" title={`${event["Google Calendar/Name"]} · ${time}`}><span className="mr-1 opacity-70">{time}</span>{event["Google Calendar/Name"]}</button>;
                  })}{events.length > 3 ? <p className="px-1 text-[9px] font-medium">+{events.length - 3} more events</p> : null}</div> : <div className="space-y-1">{workPreviews.map((preview) => {
                    if (preview.kind === "completed") {
                      const courseName = preview.item["University/Course"]?.["University/Name"] ?? null;
                      const courseTag = courseSourceTag(courseName);
                      return <button key={`completed-${preview.item["fibery/id"]}`} type="button" onClick={(click) => {click.stopPropagation(); setEditingCompleted(preview.item);}} className={cn("block w-full truncate rounded px-1.5 py-1 text-left text-[9px] font-semibold highlight-green", isAssessmentName(preview.item["University/Name"]) && "ring-2 ring-violet")} title={`Completed assignment${courseName ? ` · ${courseName}` : ""}: ${preview.item["University/Name"]}`}><CheckCircle2 className="mr-1 inline size-2.5" />{courseTag ? <span className="mr-1 inline-flex rounded border-l-2 border-border bg-background px-1 py-0.5 text-[7px] font-bold leading-none tracking-[0.08em] text-foreground" style={paintsQuery.data?.courseColor ? {borderLeftColor: paintsQuery.data.courseColor} : undefined}>{courseTag}</span> : null}{preview.item["University/Name"]}</button>;
                    }
                    const social = isSocialWorkItem(preview.item);
                    const courseName = preview.item.type === "Assignment" ? preview.item.context : null;
                    const courseTag = courseSourceTag(courseName);
                    return <button key={`${preview.item.type}-${preview.item.id}`} type="button" onClick={(click) => {click.stopPropagation(); setEditingTask(preview.item);}} className={cn("block w-full truncate rounded px-1.5 py-1 text-left text-[9px] font-medium", social ? "highlight-pink border border-pink" : isAssessmentName(preview.item.name) ? "highlight-violet" : sourceTone(preview.item.type))} title={`${social ? "Social · " : courseName ? `${courseName} · ` : ""}${preview.item.type}: ${preview.item.name}`}>{social ? <Users className="mr-1 inline size-2.5" /> : courseTag ? <span className="mr-1 inline-flex rounded border-l-2 border-border bg-background px-1 py-0.5 text-[7px] font-bold leading-none tracking-[0.08em] text-foreground" style={paintsQuery.data?.courseColor ? {borderLeftColor: paintsQuery.data.courseColor} : undefined}>{courseTag}</span> : preview.item.type === "To-Do" ? <span className="mr-1 opacity-70">T</span> : null}{preview.item.name}</button>;
                  })}{hiddenWorkCount ? <p className="px-1 text-[9px] font-medium">+{hiddenWorkCount} more work item{hiddenWorkCount === 1 ? "" : "s"}</p> : null}</div>}
                  <div className="mt-auto flex items-center justify-between border-t pt-2 text-[9px]"><span className="font-semibold">{footerLabel}</span>{breakdown ? <span>{breakdown}</span> : null}</div>
                </div>
              </div>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-[11px] text-muted-foreground"><span>{preferences.showCalendar ? "Click a blue event to open its synced Google Calendar record; workload counts stay below it." : "Social to-dos headline each day; green entries open their completed archive records."}</span>{preferences.showCalendar ? <div className="flex items-center gap-1.5"><span>Less</span>{[0, 1, 2, 3, 4, 5].map((heatLevel) => <span key={heatLevel} className={cn("size-3 rounded-sm border bg-card", heatTone(heatLevel, "calendar"))} />)}<span>More events</span></div> : <div className="flex items-center gap-3"><span className="flex items-center gap-1.5"><span className={cn("size-3 rounded-sm border", heatTone(4, "work"))} />Open due</span><span className="flex items-center gap-1.5"><span className={cn("size-3 rounded-sm border", heatTone(4, "completed"))} />Completed assignment</span></div>}</div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,1fr)]">
          <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3"><SectionTitle icon={<CheckCircle2 className="size-4" />} title="Monthly momentum" detail={`Completed work during ${format(month, "MMMM")}`} /><div className="text-right"><p className="text-2xl font-semibold">{monthCompleted}</p><p className="text-[10px] uppercase text-muted-foreground">completed</p></div></div>
            <DailyQuote />
            <div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={completionChart} margin={{top: 8, right: 8, bottom: 0, left: -24}}><defs><linearGradient id="completionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--highlight-green-fg)" stopOpacity={0.55} /><stop offset="95%" stopColor="var(--highlight-green-bg)" stopOpacity={0.08} /></linearGradient></defs><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(completionChart.length / 6) - 1)} tick={{fill: "var(--muted-foreground)", fontSize: 10}} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: "var(--muted-foreground)", fontSize: 10}} /><Tooltip content={<ChartTooltip />} cursor={{stroke: "var(--border)"}} /><Area type="monotone" dataKey="completed" stroke="var(--highlight-green-fg)" strokeWidth={2} fill="url(#completionFill)" /></AreaChart></ResponsiveContainer></div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><SectionTitle icon={<GraduationCap className="size-4" />} title="Degree map" detail="Editable courses and credits by term" /><span className="rounded-full highlight-blue px-2.5 py-1 text-xs font-semibold">{totalCredits} credits</span></div>
            <div className="grid gap-3 sm:grid-cols-2">{courseGroups.map((group) => {
              const credits = group.courses.reduce((sum, course) => sum + (course["University/Credit Hours"] ?? 0), 0);
              return <div key={group.name} className="overflow-hidden rounded-xl border bg-background">
                <div className="flex items-center justify-between border-b bg-muted px-3 py-2.5">
                  <div className="flex items-center gap-2"><span className="h-5 w-1 rounded-full bg-primary" /><h3 className="text-xs font-semibold uppercase tracking-wide">{group.name}</h3></div>
                  <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold">{credits} credits</span>
                </div>
                <div className="space-y-1.5 p-2.5">{group.courses.length ? group.courses.map((course) => <div key={course["fibery/id"]} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-l-4 bg-card px-2.5 py-2 hover:bg-muted" style={paintsQuery.data?.courseColor ? {borderLeftColor: paintsQuery.data.courseColor} : undefined}>
                  <button type="button" onClick={() => setEditingCourse(course)} className="flex min-w-0 items-center gap-2 text-left"><span className="grid size-7 shrink-0 place-items-center rounded-md highlight-blue"><BookOpen className="size-3.5" /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold hover:underline">{course["University/Name"]}</span><span className="text-[10px] text-muted-foreground">{course["University/Credit Hours"] ?? 0} credit hours</span></span></button>
                  <select aria-label={`Move ${course["University/Name"]} to another term`} value={course["University/Academic Year"]?.["fibery/id"] ?? ""} onChange={(event) => yearMutation.mutate({id: course["fibery/id"], optionId: event.target.value})} className="max-w-24 truncate rounded-md border bg-background px-2 py-1 text-[9px]"><option value="">Unassigned</option>{(academicYearsQuery.data ?? []).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
                  <button type="button" onClick={() => setEditingCourse(course)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Edit ${course["University/Name"]}`}><Pencil className="size-3" /></button>
                </div>) : <p className="py-3 text-center text-xs text-muted-foreground">No courses in this term.</p>}</div>
              </div>;
            })}</div>
          </div>
        </section>
      </div>

      {showSettings ? <SettingsPanel preferences={preferences} onChange={updatePreference} onReset={() => setPreferences(DEFAULT_PREFS)} onClose={() => setShowSettings(false)} /> : null}
      {showQuickAdd ? <QuickAdd courses={courses} priorities={prioritiesQuery.data ?? []} categories={categoriesQuery.data ?? []} academicYears={academicYearsQuery.data ?? []} assignmentStates={assignmentStates} todoStates={todoStates} completionOptions={completionOptions} onClose={() => setShowQuickAdd(false)} /> : null}
      {editingTask ? <TaskEditor item={editingTask} courses={courses} priorities={prioritiesQuery.data ?? []} categories={categoriesQuery.data ?? []} assignmentStates={assignmentStates} todoStates={todoStates} completionOptions={completionOptions} onClose={() => setEditingTask(null)} /> : null}
      {editingCompleted ? <CompletedEditor item={editingCompleted} courses={courses} priorities={completedPrioritiesQuery.data ?? []} categories={completedCategoriesQuery.data ?? []} types={completedTypesQuery.data ?? []} onClose={() => setEditingCompleted(null)} /> : null}
      {editingCourse ? <CourseEditor course={editingCourse} academicYears={academicYearsQuery.data ?? []} onClose={() => setEditingCourse(null)} /> : null}
    </main>
  );
}
