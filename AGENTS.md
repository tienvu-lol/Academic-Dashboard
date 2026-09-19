# Project working agreement

- After code changes, run `bun run lint`, `bun run typecheck`, and `bun run test`.
- Keep `@shadcn/lint` rules opt-in; do not choose or enable design-system policy rules without user direction.
- Ask before adding optional plugins, native hosts, or completing a new application-stack layer beyond the requested scope.
- Keep Bun SQL and domain modules independent from the UI renderer.
