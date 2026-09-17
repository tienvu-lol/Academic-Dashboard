export const storage = {text: '', fail: false, writes: 0, hold: null};
export const useSyncExternalStore = (_, snapshot) => snapshot();
export const NativeModules = {WorkspaceFiles: {
  Read: async () => storage.text,
  Write: async text => {if (storage.hold) await storage.hold; if (storage.fail) throw new Error('disk full'); storage.text = text; storage.writes++;},
  StoragePath: () => 'test/workspace.json',
}};
