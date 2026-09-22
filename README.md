# Academic Dashboard

![Academic Dashboard](artifacts/ui-dashboard-1440x900.png)

A lightweight desktop academic management application built to centralize coursework, assignments, schedules, notes, and degree progress in one place.

Academic Dashboard is designed around a simple idea: students should not need five different websites, spreadsheets, calendars, and note-taking systems just to understand what they need to do next.

The project is currently being developed as a native-oriented desktop application with a focus on performance, modularity, and a clean information-dense interface.

---

## Overview

Academic Dashboard provides a unified workspace for tracking:

* Assignments and deadlines
* Courses and semesters
* Academic progress
* Calendar events
* Notes
* Upcoming quizzes, exams, and finals
* Degree requirements
* Semester workload and momentum

The goal is to provide the usefulness of a full academic planning platform without the overhead of a traditional browser-based productivity suite.

---

## Features

### Dashboard

![Dashboard Layout Editing](artifacts/ui-edit-layout.png)

A centralized overview of the student's current academic state.

* Today's assignments
* Upcoming deadlines
* Overdue work
* Course-specific task organization
* Priority and assessment indicators
* Semester progress visualization

### Assignment Tracking

Assignments can be organized by:

* Course
* Due date
* Category
* Completion status
* Assessment type
* Priority

Assignments can be surfaced automatically across dashboard views based on their state and due date.

### Calendar

![Calendar View](artifacts/ui-calendar-week.png)

Academic deadlines and events can be viewed through calendar-based interfaces to provide both short-term and long-term planning.

Planned functionality includes:

* Monthly calendar
* Assignment deadlines
* Exam and quiz highlighting
* Course color coding
* External calendar integration

### Degree Planning

A visual degree map for tracking academic progress across semesters.

Designed to eventually support:

* Completed courses
* Current courses
* Planned courses
* Prerequisites
* Degree requirements
* Transfer credit
* Multi-year academic planning

### Notes

Integrated Markdown-based notes allow academic context to live beside coursework rather than in a completely separate application.

### Academic Analytics

![Analytics View](artifacts/ui-analytics.png)

Dashboard visualizations are intended to make workload and progress easier to understand at a glance.

Examples include:

* Semester completion
* Assignment distribution
* Calendar heatmaps
* Monthly momentum
* Course workload

---

## Tech Stack

| Layer             | Technology       |
| ----------------- | ---------------- |
| Runtime           | Bun              |
| Language          | TypeScript       |
| UI                | React            |
| Native UI Runtime | GPUIX            |
| Native Bindings   | `@gpuix/native`  |
| React Integration | `@gpuix/react`   |
| Local Data        | Bun SQL / SQLite |
| Testing           | Bun Test         |
| Type Checking     | TypeScript       |

The project intentionally avoids the traditional Electron architecture where possible.

GPUIX provides the desktop rendering/runtime layer while React and TypeScript provide the application and component architecture.

---

## Architecture

```text
Academic Dashboard
│
├── Application Layer
│   ├── Dashboard
│   ├── Assignments
│   ├── Calendar
│   ├── Courses
│   ├── Degree Planning
│   └── Notes
│
├── React Component Layer
│   ├── Views
│   ├── Widgets
│   ├── Navigation
│   └── Shared Components
│
├── Data Layer
│   ├── Models
│   ├── Workspace State
│   ├── Assignment Storage
│   └── Local Database
│
├── Runtime Layer
│   ├── Bun
│   └── TypeScript
│
└── Native Layer
    ├── GPUIX
    ├── @gpuix/react
    └── @gpuix/native
```

The application is structured so that UI components remain separated from persistent storage and platform-specific behavior.

This makes it easier to modify or replace individual layers without restructuring the entire application.

---

## Getting Started

### Requirements

Install:

* [Bun](https://bun.sh/)
* Git

Clone the repository:

```bash
git clone <repository-url>
cd Academic-Dashboard
```

Install dependencies:

```bash
bun install
```

Run the application:

```bash
bun run dev
```

---

## Development

The development entry point is:

```text
src/main.tsx
```

The application initializes through GPUIX:

```tsx
import { render } from "@gpuix/react";
import App from "./dashboard-components/App";
import "./platform/runtime";

render(<App />, {
  title: "Academic Dashboard",
  width: 1280,
  height: 820,
  minWidth: 900,
  minHeight: 620,
});
```

GPUIX creates the native application window while the React application defines the interface rendered inside it.

---

## Scripts

Start the development runtime:

```bash
bun run dev
```

Run tests:

```bash
bun test
```

Run TypeScript validation:

```bash
bun run typecheck
```

Run the full validation pipeline:

```bash
bun run check
```

Equivalent configuration:

```json
{
  "scripts": {
    "dev": "bun --hot src/main.tsx",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "check": "bun run typecheck && bun run test"
  }
}
```

---

## Project Structure

```text
Academic-Dashboard/
│
├── src/
│   ├── main.tsx
│   │
│   ├── dashboard-components/
│   │   ├── App
│   │   ├── Dashboard
│   │   ├── Calendar
│   │   ├── Assignments
│   │   └── SemesterChart
│   │
│   ├── platform/
│   │   └── runtime
│   │
│   ├── storage/
│   │
│   └── ...
│
├── package.json
├── tsconfig.json
├── bun.lock
└── README.md
```

> The internal architecture is actively evolving as the project transitions toward a more modular native application design.

---

## Design Goals

Academic Dashboard is being built around several core principles.

### Fast

Opening the dashboard should feel closer to opening a native utility than loading a web application.

### Local First

Core academic information should remain usable without relying on an external server.

### Information Dense

Academic applications contain a large amount of information.

The interface should expose important information without overwhelming the user or wasting screen space.

### Modular

Assignments, calendars, degree planning, analytics, and notes should operate as independent modules connected through shared application state.

### Extensible

The architecture should eventually allow integrations with services such as:

* Canvas
* Google Calendar
* University course systems
* External calendars
* Academic APIs
* AI-assisted planning tools

---

## Current Development Status

> **Early Development / Active Refactor**

### Implemented

* [x] Core dashboard
* [x] Assignment tracking
* [x] Calendar functionality
* [x] Course organization
* [x] Dashboard analytics
* [x] Local application state
* [x] Bun runtime
* [x] GPUIX application shell
* [x] React + TypeScript component architecture
* [x] Initial automated tests

### In Progress

* [ ] UI/UX overhaul
* [ ] Modular dashboard layout
* [ ] Improved component architecture
* [ ] Persistent local database architecture
* [ ] Improved calendar workflows
* [ ] Degree planning improvements
* [ ] Native desktop interaction patterns

### Planned

* [ ] Drag-and-drop dashboard modules
* [ ] Resizable dashboard panels
* [ ] Canvas integration
* [ ] Google Calendar integration
* [ ] Notification system
* [ ] Automated assignment importing
* [ ] Academic analytics
* [ ] Degree requirement engine
* [ ] Search and command palette
* [ ] AI-assisted academic planning

---

## Long-Term Vision

Academic Dashboard is intended to become more than an assignment tracker.

The long-term goal is a local academic operating system where a student can answer questions such as:

> What do I need to do today?

> What deadlines are approaching?

> Which class is consuming most of my time?

> What requirements remain in my degree?

> What courses can I take next semester?

> How heavy will my next semester be?

> Am I falling behind compared with earlier in the semester?

without switching between multiple university portals and productivity applications.

---

## Contributing

The project is currently under active development.

Issues, architectural suggestions, UI/UX improvements, and contributions are welcome as the application matures.

For major architectural changes, open an issue or discussion before submitting a pull request.

---

## License

License information will be added as the project approaches a public release.

---

## Author

Built as an independent project exploring native application development, academic productivity systems, and human-computer interaction.
