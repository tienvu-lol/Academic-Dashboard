import path from "node:path";

const projectRoot = path.resolve(import.meta.dir, "..");

export async function buildElectronMain() {
  const result = await Bun.build({
    entrypoints: [path.join(projectRoot, "electron/main.ts")],
    target: "node",
    format: "esm",
    outdir: path.join(projectRoot, "dist-electron"),
    naming: "main.mjs",
    external: ["electron"],
    sourcemap: "linked",
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("Electron main-process build failed.");
  }
  const preload = await Bun.build({
    entrypoints: [path.join(projectRoot, 'electron/preload.ts')],
    target: 'node', format: 'cjs', outdir: path.join(projectRoot, 'dist-electron'),
    naming: 'preload.cjs', external: ['electron'],
  });
  if (!preload.success) throw new AggregateError(preload.logs, 'Preload build failed.');
}

export async function spawnElectron(extraEnvironment: Record<string, string> = {}, flags: string[] = []) {
  const electronPackage = await import("electron");
  const executablePath = (electronPackage as unknown as { default: unknown }).default;

  if (typeof executablePath !== "string" || !(await Bun.file(executablePath).exists())) {
    throw new Error("Electron executable is missing. Run `bun install` and try again.");
  }

  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && entry[0] !== "ELECTRON_RUN_AS_NODE",
    ),
  );

  return Bun.spawn([executablePath, ...flags, path.join(projectRoot, "dist-electron/main.mjs")], {
    cwd: projectRoot,
    env: { ...environment, ...extraEnvironment },
    stdout: "inherit",
    stderr: "inherit",
  });
}
