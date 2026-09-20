import { emptyAcademicData, hydrateEntity, isRecord, validateAcademicData, type Entity } from './academic';
import { DEFAULT_PREFS } from '../dashboard';
import { emptyDatabase, parseDatabase, todayLocal } from '../internships/model';
import type { Workspace } from '../platform/workspace';
import { validLayouts, type Layouts } from './layout';
import { validateCalendarEvents } from './calendar';

export type TaskKind = 'Assignment' | 'To-Do';
export type OrderRule = 'keywords' | 'priority' | 'course' | 'due';
export interface DashboardSettings {
  keywords: string[]; order: OrderRule[]; courseOrder: string[];
  internshipCategories: string[]; sidebarSlim: boolean;
  taskOrder?: string[];
  layouts?: Layouts;
  creditPlan?: { target: number; notes: string; requirements: CreditRequirement[] };
}
export interface CreditRequirement { id: string; name: string; target: number; courseIds: string[]; notes: string }
export const defaultSettings: DashboardSettings = {
  keywords: ['Test', 'Exam'], order: ['keywords', 'priority', 'due', 'course'],
  courseOrder: [], internshipCategories: [], sidebarSlim: false,
};
export const palette = ['#5D9DFC', '#5c946e', '#FF4444'];
export const collectionFor = (kind: TaskKind) => kind === 'Assignment' ? 'University/Assignments' as const : 'University/To-Dos' as const;
export const refId = (value: unknown): string => isRecord(value) ? String(value['fibery/id'] ?? '') : '';
export const text = (value: unknown): string => typeof value === 'string' ? value : '';
export function settingsFor(workspace: Workspace): DashboardSettings {
  return { ...structuredClone(defaultSettings), ...workspace.dashboardSettings };
}
export function emptyWorkspace(): Workspace {
  return { format: 'academic-dashboard-workspace', version: 2, academic: emptyAcademicData(), internships: emptyDatabase(), preferences: { ...DEFAULT_PREFS }, calendarEvents: [], dashboardSettings: structuredClone(defaultSettings) };
}
export function validateDashboardWorkspace(value: unknown): asserts value is Workspace {
  if (!isRecord(value) || value.format !== 'academic-dashboard-workspace' || value.version !== 2) throw new Error('Unsupported workspace.');
  validateAcademicData(value.academic);
  parseDatabase(JSON.stringify(value.internships));
  if (!isRecord(value.preferences) || Object.keys(DEFAULT_PREFS).some(key => typeof (value.preferences as Record<string, unknown>)[key] !== 'boolean')) throw new Error('Invalid preferences.');
  validateCalendarEvents(value.calendarEvents ?? []);
  if (value.dashboardSettings !== undefined) {
    const s = value.dashboardSettings;
    if (!isRecord(s) || !Array.isArray(s.order) || s.order.length !== 4 || new Set(s.order).size !== 4 || s.order.some(x => !['keywords', 'priority', 'due', 'course'].includes(x)) || typeof s.sidebarSlim !== 'boolean') throw new Error('Invalid priority ordering.');
    for (const field of ['keywords', 'courseOrder', 'internshipCategories']) if (!Array.isArray(s[field]) || !(s[field] as unknown[]).every(x => typeof x === 'string')) throw new Error('Invalid dashboard settings.');
    if (s.taskOrder !== undefined && (!Array.isArray(s.taskOrder) || !s.taskOrder.every(x => typeof x === 'string'))) throw new Error('Invalid task order.');
    if (s.layouts !== undefined && !validLayouts(s.layouts)) throw new Error('Invalid widget layouts.');
    if (s.creditPlan !== undefined) {
      const p = s.creditPlan;
      if (!isRecord(p) || typeof p.target !== 'number' || !Number.isFinite(p.target) || p.target < 0 || typeof p.notes !== 'string' || !Array.isArray(p.requirements)) throw new Error('Invalid credit plan.');
      for (const r of p.requirements) if (!isRecord(r) || typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.target !== 'number' || !Number.isFinite(r.target) || r.target < 0 || typeof r.notes !== 'string' || !Array.isArray(r.courseIds) || !r.courseIds.every(x => typeof x === 'string')) throw new Error('Invalid credit requirement.');
    }
  }
}
export interface Task {
  id: string; kind: TaskKind; name: string; courseId: string; categoryId: string;
  course: string; category: string; due: string; end: string; priority: string;
  completed: boolean; color: string; entity: Entity;
}
export function coursesFor(workspace: Workspace) { return workspace.academic.collections['University/Courses'].map(row => hydrateEntity(row, workspace.academic)); }
export function tasksFor(workspace: Workspace): Task[] {
  const courses = coursesFor(workspace);
  return (['Assignment', 'To-Do'] as const).flatMap(kind => workspace.academic.collections[collectionFor(kind)].map(raw => {
    const row = hydrateEntity(raw, workspace.academic);
    const courseId = refId(row['University/Course']);
    const course = courses.find(x => x['fibery/id'] === courseId);
    const state = row['workflow/state'] as Record<string, unknown> | undefined;
    const optionName = (field: string) => isRecord(row[field]) ? text(row[field]['enum/name']) : '';
    const categoryId = refId(row['University/Category']);
    const category = workspace.academic.options['University/Category']?.find(x => x.id === categoryId);
    const index = Math.max(0, courses.findIndex(x => x['fibery/id'] === courseId));
    return { id: row['fibery/id'], kind, name: row['University/Name'], courseId, categoryId,
      course: course?.['University/Name'] ?? '', category: category?.name ?? '',
      due: text(row['University/Due Date']), end: text(row['Dashboard/End']), priority: optionName('University/Priority') || 'Medium',
      completed: row['Dashboard/Completed'] === true || /^(done|completed)$/i.test(text(state?.['enum/name'])),
      color: text(course?.['Dashboard/Color']) || (kind === 'To-Do' ? category?.color : '') || palette[index % palette.length], entity: raw };
  }));
}
export function isHighlighted(task: Task, settings: DashboardSettings) {
  const words = task.name.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return settings.keywords.some(keyword => keyword.trim() && (keyword.includes(' ') ? task.name.toLowerCase().includes(keyword.toLowerCase().trim()) : words.includes(keyword.toLowerCase().trim())));
}
export function dueTime(task: Pick<Task, 'due'>): number {
  return task.due ? new Date(task.due.includes('T') ? task.due : task.due + 'T23:59:59').getTime() : Infinity;
}
export function orderedTasks(tasks: Task[], settings: DashboardSettings): Task[] {
  const priority = (s: string) => ({ Urgent: 4, High: 3, Medium: 2, Low: 1 }[s] ?? 2);
  const rank = (id: string) => { const index = settings.courseOrder.indexOf(id); return index < 0 ? settings.courseOrder.length : index; };
  return [...tasks].sort((a, b) => {
    for (const rule of settings.order) {
      const difference = rule === 'keywords' ? Number(isHighlighted(b, settings)) - Number(isHighlighted(a, settings))
        : rule === 'priority' ? priority(b.priority) - priority(a.priority)
        : rule === 'course' ? rank(a.courseId) - rank(b.courseId) : dueTime(a) - dueTime(b);
      if (difference && !Number.isNaN(difference)) return difference;
    }
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
export function summaryFor(tasks: Task[], now = new Date()) {
  const active = tasks.filter(t => !t.completed);
  return { total: tasks.length, upcoming: active.filter(t => dueTime(t) >= now.getTime() && dueTime(t) <= now.getTime() + 48 * 3600000).length, overdue: active.filter(t => dueTime(t) < now.getTime()).length };
}
export function taskDay(task: Task) { return task.due.includes('T') ? todayLocal(new Date(task.due)) : task.due; }
export function calendarLoads(tasks: Task[]) {
  const loads: Record<string, { pending: number; completed: number }> = {};
  for (const task of tasks) {
    if (task.kind !== 'Assignment' || !task.due) continue;
    const day = taskDay(task);
    const load = loads[day] ??= { pending: 0, completed: 0 };
    load[task.completed ? 'completed' : 'pending']++;
  }
  return loads;
}
export function removeCourse(workspace: Workspace, id: string) {
  workspace.academic.collections['University/Courses'] = workspace.academic.collections['University/Courses'].filter(x => x['fibery/id'] !== id);
  for (const rows of Object.values(workspace.academic.collections)) for (const row of rows) if (refId(row['University/Course']) === id) row['University/Course'] = null;
  const settings = settingsFor(workspace); settings.courseOrder = settings.courseOrder.filter(x => x !== id); workspace.dashboardSettings = settings;
  for (const requirement of settings.creditPlan?.requirements ?? []) requirement.courseIds = requirement.courseIds.filter(x => x !== id);
  for (const event of workspace.calendarEvents ?? []) if (event.courseId === id) event.courseId = '';
}

export const taskKey = (task: Pick<Task, 'id' | 'kind'>) => task.kind + ':' + task.id;
export function manuallyOrderedTasks(tasks: Task[], settings: DashboardSettings) {
  const rows = orderedTasks(tasks, settings);
  const order = settings.taskOrder ?? [];
  return rows.sort((a, b) => {
    const rank = (task: Task) => { const index = order.indexOf(taskKey(task)); return index < 0 ? order.length : index; };
    return rank(a) - rank(b);
  });
}
export function reorderIds(order: string[], from: string, to: string) {
  if (from === to || !order.includes(from) || !order.includes(to)) return [...order];
  const result = order.filter(id => id !== from);
  result.splice(order.indexOf(to), 0, from);
  return result;
}
export function setTaskCompleted(workspace: Workspace, task: Task, completed: boolean, now = new Date()) {
  const row = workspace.academic.collections[collectionFor(task.kind)].find(x => x['fibery/id'] === task.id);
  if (!row) return;
  row['Dashboard/Completed'] = completed;
  row['University/Completion Date'] = completed ? todayLocal(now) : null;
  const options = workspace.academic.options['workflow/state'] ??= [];
  const name = completed ? 'Done' : 'Not Started';
  let state = options.find(x => x.name === name);
  if (!state) { state = { id: crypto.randomUUID(), name }; options.push(state); }
  row['workflow/state'] = { 'fibery/id': state.id };
}
export function taskHistory(workspace: Workspace) {
  const current = tasksFor(workspace).map(task => ({ id: taskKey(task), name: task.name, due: taskDay(task), completed: task.completed, done: task.completed ? text(task.entity['University/Completion Date']).slice(0, 10) : '' }));
  const archived = workspace.academic.collections['University/Completed Work'].map(row => ({ id: 'Archived:' + row['fibery/id'], name: row['University/Name'], due: text(row['University/Original Due Date']).slice(0, 10), completed: true, done: text(row['University/Completion Date']).slice(0, 10) }));
  return [...current, ...archived];
}
export function activityCounts(dates: string[]) {
  const counts: Record<string, number> = {};
  for (const day of dates) if (/^\d{4}-\d{2}-\d{2}$/.test(day)) counts[day] = (counts[day] ?? 0) + 1;
  return counts;
}
export function timelineFor(workspace: Workspace, start: string, end: string) {
  const history = taskHistory(workspace);
  const due = activityCounts(history.map(x => x.due)), done = activityCounts(history.map(x => x.done));
  let dueTotal = Object.entries(due).reduce((n, [day, count]) => n + (day < start ? count : 0), 0);
  let doneTotal = Object.entries(done).reduce((n, [day, count]) => n + (day < start ? count : 0), 0);
  const result: { date: string; due: number; done: number }[] = [];
  const cursor = new Date(start + 'T12:00:00');
  while (todayLocal(cursor) <= end && result.length < 3700) {
    const date = todayLocal(cursor);
    dueTotal += due[date] ?? 0; doneTotal += done[date] ?? 0;
    result.push({ date, due: dueTotal, done: doneTotal });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
export function ensureDailyNote(workspace: Workspace, day = todayLocal()) {
  const notes = workspace.academic.collections['University/Dashboard Notes'];
  if (notes.some(note => note['Dashboard/Date'] === day)) return false;
  notes.push({ 'fibery/id': 'daily:' + day, 'University/Name': day, 'Dashboard/Date': day, 'University/Markdown': '# ' + day + '\n\n## Focus\n\n- \n\n## Notes\n\n' });
  return true;
}
export function courseStatus(course: Entity): 'completed' | 'planned' | 'in-progress' {
  return course['Dashboard/Completed'] === true ? 'completed' : course['Dashboard/PlanStatus'] === 'planned' ? 'planned' : 'in-progress';
}
export function creditTotals(courses: Entity[]) {
  const result = { completed: 0, planned: 0, inProgress: 0 };
  for (const course of courses) { const status = courseStatus(course); result[status === 'in-progress' ? 'inProgress' : status] += Number(course['University/Credit Hours'] ?? 0); }
  return result;
}
export function removeCategory(workspace: Workspace, id: string) {
  workspace.academic.options['University/Category'] = workspace.academic.options['University/Category'].filter(x => x.id !== id);
  for (const rows of Object.values(workspace.academic.collections)) for (const row of rows) if (refId(row['University/Category']) === id) row['University/Category'] = null;
}
