import 'react-native-url-polyfill/auto';
import {NativeModules} from 'react-native';

// The shared repositories contain JSON documents; preserve their JSON semantics
// on Hermes without pulling browser APIs into native screens.
if (!globalThis.structuredClone) {
  globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
}
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {configurable: true, value: {
    randomUUID: () => NativeModules.WorkspaceFiles.NewId(),
  }});
}
