# Academic Dashboard

The repository is at a clean Bun-based foundation while the application stack is reconstructed.

## Current state

Retained source:

- `src/dashboard-components/` - the main dashboard UI components, preserved as migration input
- `src/data/` and `src/lib/` - academic records, imports, and data helpers
- `src/internships/` - internship records, imports, storage, and reporting logic
- `src/platform/` - workspace contracts and platform-facing state
- `src/dashboard.ts` and `src/completeWork.ts` - shared dashboard behavior

Removed infrastructure:

- React Native Windows and the C++/WinUI host
- Metro, Babel, and Windows Jest configuration
- Windows installer, packaging, release, and PowerShell launch workflows
- npm lock state and Node-based test loaders

The retained UI is intentionally not wired to a runtime. It still documents the previous component structure and will be adapted after the next application stack is selected.

## Runtime

[Bun](https://bun.sh/) is the only project runtime and package manager. Node.js and npm are not part of the project workflow.

Run the preserved domain test suite with:

```sh
bun test
```

or:

```sh
bun run check
```

There are currently no `dev`, `build`, installer, or release commands. Those should be added only after the replacement application architecture is chosen.
