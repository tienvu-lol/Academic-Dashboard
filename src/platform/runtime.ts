// Keep the retained data layer independent from whichever UI runtime is selected
// next. Bun provides this API; the fallback supports other standards-based
// runtimes used by future tests or tooling.
if (!globalThis.structuredClone) {
  globalThis.structuredClone = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value));
}
