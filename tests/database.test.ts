import { afterEach, expect, test } from "bun:test";
import { emptyAcademicData } from "../src/data/academic";
import { DEFAULT_PREFS } from "../src/dashboard";
import { createInternship, emptyDatabase } from "../src/internships/model";
import { BunSqlWorkspaceRepository } from "../src/platform/database";
import type { Workspace } from "../src/platform/workspace";

const repositories: BunSqlWorkspaceRepository[] = [];
afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.close()));
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
  };

  await repository.save(workspace);
  const restored = await repository.load();

  expect(restored?.academic.collections["University/Courses"][0]["University/Name"]).toBe("Operating Systems");
  expect(restored?.internships.internships[0].company).toBe("Example Labs");
  expect(restored?.preferences).toEqual(DEFAULT_PREFS);
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
  };
  await repository.save(first);
  const second = structuredClone(first);
  second.preferences.compact = true;
  await repository.save(second);
  expect((await repository.load())?.preferences.compact).toBe(true);
});
