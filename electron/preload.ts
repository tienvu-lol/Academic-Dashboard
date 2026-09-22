import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('dashboard', {
  load: () => ipcRenderer.invoke('workspace:load'),
  save: (snapshot: unknown) => ipcRenderer.invoke('workspace:save', snapshot),
});
