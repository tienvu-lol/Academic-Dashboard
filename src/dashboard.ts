export type EnumRef = {
  "fibery/id": string;
  "enum/name": string;
  "enum/color"?: string | null;
  "enum/icon"?: string | null;
} | null;
export type CourseRef = {"fibery/id": string; "University/Name": string} | null;

export type Assignment = {
  "fibery/id": string;
  "fibery/public-id": string;
  "University/Name": string;
  "University/Due Date": string | null;
  "University/Days Left": string | null;
  "University/Course": CourseRef;
  "University/Priority": EnumRef;
  "workflow/state": EnumRef;
};

export type Todo = {
  "fibery/id": string;
  "fibery/public-id": string;
  "University/Name": string;
  "University/Due Date": string | null;
  "University/Days Left": string | null;
  "University/Category": EnumRef;
  "workflow/state": EnumRef;
};

export type Course = {
  "fibery/id": string;
  "fibery/public-id": string;
  "University/Name": string;
  "University/Credit Hours": number | null;
  "University/Academic Year": EnumRef;
};

export type CompletedWork = {
  "fibery/id": string;
  "fibery/public-id": string;
  "University/Name": string;
  "University/Completion Date": string | null;
  "University/Original Due Date": string | null;
  "University/Course": CourseRef;
  "University/Category": EnumRef;
  "University/Priority": EnumRef;
  "University/Type": EnumRef;
};

export type DateRange = {start: string; end: string};
export type CalendarEvent = {
  "fibery/id": string;
  "fibery/public-id": string;
  "Google Calendar/Name": string;
  "Google Calendar/Dates": DateRange | null;
  "Google Calendar/Location": string | null;
};

export type WorkItem = {
  id: string;
  publicId: string;
  type: "Assignment" | "To-Do";
  name: string;
  dueDate: string | null;
  state: string;
  stateId: string;
  context: string;
  contextId: string;
  contextColor: string | null;
  contextIcon: string | null;
  tag: string;
  tagId: string;
  tagColor: string | null;
  tagIcon: string | null;
};

export type DashboardNote = {
  "fibery/id": string;
  "fibery/public-id": string;
  "University/Name": string;
  "University/Markdown": string | null;
};

export type Preferences = {
  showAssignments: boolean;
  showTodos: boolean;
  showCalendar: boolean;
  compact: boolean;
  mondayFirst: boolean;
  showNotes: boolean;
  showMomentum: boolean;
  showCourses: boolean;
};

export const DEFAULT_PREFS: Preferences = {
  showAssignments: true,
  showTodos: true,
  showCalendar: false,
  compact: false,
  mondayFirst: false,
  showNotes: true,
  showMomentum: true,
  showCourses: true,
};

export function dateKey(value: Date | string) {
  if (typeof value === "string") {
    if (!value.includes("T")) return value.slice(0, 10);
    return dateKey(new Date(value));
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDone(state: string) {
  return state.toLowerCase() === "done";
}

export function stateTone(state: string) {
  if (state === "Done") return "highlight-green";
  if (state === "In Progress") return "highlight-blue";
  return "highlight-grey";
}

export function sourceTone(source: string) {
  return source === "Assignment" ? "highlight-pink" : "highlight-aquamarine";
}

export function heatTone(level: number, mode: "work" | "calendar" | "completed" = "work") {
  const workTones = [
    "bg-transparent",
    "highlight-pink opacity-20",
    "highlight-pink opacity-35",
    "highlight-pink opacity-50",
    "highlight-pink opacity-70",
    "highlight-pink opacity-90",
  ];
  const calendarTones = [
    "bg-transparent",
    "highlight-blue opacity-20",
    "highlight-blue opacity-35",
    "highlight-blue opacity-50",
    "highlight-blue opacity-70",
    "highlight-blue opacity-90",
  ];
  const completedTones = [
    "bg-transparent",
    "highlight-green opacity-20",
    "highlight-green opacity-35",
    "highlight-green opacity-50",
    "highlight-green opacity-70",
    "highlight-green opacity-90",
  ];
  const index = Math.max(0, Math.min(5, Math.ceil(level)));
  return (mode === "calendar" ? calendarTones : mode === "completed" ? completedTones : workTones)[index];
}

export function friendlyError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
