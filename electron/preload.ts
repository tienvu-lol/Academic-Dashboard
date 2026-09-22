import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('dashboard', {
  load: () => ipcRenderer.invoke('workspace:load'),
  save: (snapshot: unknown) => ipcRenderer.invoke('workspace:save', snapshot),
  onUpdate: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('workspace:update', listener);
    return () => ipcRenderer.removeListener('workspace:update', listener);
  },
});
