import { app, BrowserWindow, ipcMain, session } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const developmentServerUrl = process.env.VITE_DEV_SERVER_URL || undefined;
const rendererUrl = developmentServerUrl ?? pathToFileURL(path.join(moduleDirectory, '../dist/index.html')).href;

async function workspaceRequest(event: Electron.IpcMainInvokeEvent, method: string, body?: unknown) {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame || new URL(event.senderFrame.url).href !== new URL(rendererUrl).href) throw new Error('Untrusted workspace request.');
  const endpoint = process.env.DASHBOARD_DATA_URL;
  if (!endpoint || !process.env.DASHBOARD_DATA_TOKEN) throw new Error('Start the application through bun run dev or bun run start.');
  const response = await fetch(endpoint, {
    method, headers: { Authorization: 'Bearer ' + process.env.DASHBOARD_DATA_TOKEN, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Workspace request failed.');
  return result;
}
ipcMain.handle('workspace:load', event => workspaceRequest(event, 'GET'));
ipcMain.handle('workspace:save', (event, body) => workspaceRequest(event, 'PUT', body));

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createWindow() {
  const window = new BrowserWindow({
    title: "Academic Dashboard",
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: process.env.ACADEMIC_DASHBOARD_TITLE_BAR_COLOR ?? "#000000",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: process.env.ACADEMIC_DASHBOARD_TITLE_BAR_COLOR ?? "#000000",
      symbolColor: process.env.ACADEMIC_DASHBOARD_TITLE_BAR_SYMBOL_COLOR ?? "#FFF7E4",
      height: positiveInteger(process.env.ACADEMIC_DASHBOARD_TITLE_BAR_HEIGHT, 30),
    },
    webPreferences: {
      preload: path.join(moduleDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).href !== new URL(rendererUrl).href) event.preventDefault();
  });

  if (developmentServerUrl) {
    void window.loadURL(developmentServerUrl);
  } else {
    void window.loadFile(path.join(moduleDirectory, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [
      "default-src 'self'; script-src 'self'" + (developmentServerUrl ? " 'unsafe-inline'" : "") + "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" + (developmentServerUrl ? " " + new URL(developmentServerUrl).origin.replace('http:', 'ws:') : "") + "; object-src 'none'; frame-src 'none'"
    ] } });
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
