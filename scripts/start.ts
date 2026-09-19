import { spawnElectron } from "./electron-runtime";
import { startDashboardServer } from '../src/platform/dashboard-server';

const data = await startDashboardServer();
try {
  const electron = await spawnElectron({ VITE_DEV_SERVER_URL: '', DASHBOARD_DATA_URL: data.url, DASHBOARD_DATA_TOKEN: data.token });
  const stopElectron = () => electron.kill();
  process.once("SIGINT", stopElectron);
  process.once("SIGTERM", stopElectron);
  process.exitCode = await electron.exited;
  process.removeListener("SIGINT", stopElectron);
  process.removeListener("SIGTERM", stopElectron);
}
finally { await data.close(); }
