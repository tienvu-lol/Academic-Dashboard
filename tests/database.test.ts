import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyAcademicData } from "../src/data/academic";
import { DEFAULT_PREFS } from "../src/dashboard";
import { createInternship, emptyDatabase } from "../src/internships/model";
import { BunSqlWorkspaceRepository } from "../src/platform/database";
import type { Workspace } from "../src/platform/workspace";
import { emptyWorkspace } from "../src/data/planning";

const repositories: BunSqlWorkspaceRepository[] = [];
afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.close()));
});

test("calendar event series survive a SQLite repository restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "academic-calendar-test-"));
  const filename = join(directory, "workspace.sqlite");
  const workspace = emptyWorkspace();
  workspace.calendarEvents = [
    { id: "single", title: "Advising", courseId: "", type: "meeting", date: "2026-09-22", startTime: "14:00", endTime: "14:30" },
    { id: "weekly", title: "Physics", courseId: "physics", type: "class", date: "2026-09-01", startTime: "08:00", endTime: "09:15", recurrence: { kind: "weekly", weekdays: [2, 4], startDate: "2026-09-01", endDate: "2026-12-10" } },
  ];
  try {
    const first = new BunSqlWorkspaceRepository(filename);
    await first.initialize(); await first.save(workspace); await first.close();
    const reopened = new BunSqlWorkspaceRepository(filename);
    try { await reopened.initialize(); expect((await reopened.load())?.calendarEvents).toEqual(workspace.calendarEvents); }
    finally { await reopened.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Bun SQL persists academic and internship records in SQLite", async () => {
  const repository = new BunSqlWorkspaceRepository(":memory:");
  repositories.push(repository);
  await repository.initialize();
  const academic = emptyAcademicData();
  academic.collections["University/Courses"].push({
    "fibery/id": "course-1",
    "University/Name": "Operating Systems",
  });
  const internships = emptyDatabase();
  internships.internships.push({
    ...createInternship("2026-09-18"),
    id: "internship-1",
    company: "Example Labs",
    role: "Software Intern",
  });
  const workspace: Workspace = {
    format: "academic-dashboard-workspace",
    version: 2,
    academic,
    internships,
    preferences: { ...DEFAULT_PREFS },
    calendarEvents: [
      { id: "event-1", title: "Study group", courseId: "course-1", type: "study", date: "2026-09-21", startTime: "18:00", endTime: "19:30" },
      { id: "event-2", title: "Operating Systems", courseId: "course-1", type: "class", date: "2026-09-01", startTime: "09:30", endTime: "10:45", recurrence: { kind: "weekly", weekdays: [1, 3, 5], startDate: "2026-09-01", endDate: "2026-12-11" } },
    ],
  };

  await repository.save(workspace);
  const restored = await repository.load();

  expect(restored?.academic.collections["University/Courses"][0]["University/Name"]).toBe("Operating Systems");
  expect(restored?.internships.internships[0].company).toBe("Example Labs");
  expect(restored?.preferences).toEqual(DEFAULT_PREFS);
  expect(restored?.calendarEvents).toEqual(workspace.calendarEvents);
});

test("a second SQL save replaces the workspace atomically", async () => {
  const repository = new BunSqlWorkspaceRepository(":memory:");
  repositories.push(repository);
  await repository.initialize();
  const first: Workspace = {
    format: "academic-dashboard-workspace",
    version: 2,
    academic: emptyAcademicData(),
    internships: emptyDatabase(),
    preferences: { ...DEFAULT_PREFS },
    calendarEvents: [],
  };
  await repository.save(first);
  const second = structuredClone(first);
  second.preferences.compact = true;
  await repository.save(second);
  expect((await repository.load())?.preferences.compact).toBe(true);
});
