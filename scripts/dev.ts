import path from "node:path";
import { createServer } from "vite";

import { buildElectronMain, spawnElectron } from "./electron-runtime";
import { startDashboardServer } from '../src/platform/dashboard-server';

const projectRoot = path.resolve(import.meta.dir, "..");

await buildElectronMain();

const vite = await createServer({ root: projectRoot });
let data: Awaited<ReturnType<typeof startDashboardServer>> | undefined;
try {
  await vite.listen();
  vite.printUrls();
  data = await startDashboardServer();
  const electron = await spawnElectron({ VITE_DEV_SERVER_URL: vite.resolvedUrls!.local[0], DASHBOARD_DATA_URL: data.url, DASHBOARD_DATA_TOKEN: data.token });
  const stopElectron = () => electron.kill();
  process.once("SIGINT", stopElectron);
  process.once("SIGTERM", stopElectron);
  process.exitCode = await electron.exited;
  process.removeListener("SIGINT", stopElectron);
  process.removeListener("SIGTERM", stopElectron);
} finally {
  await vite.close();
  await data?.close();
}
