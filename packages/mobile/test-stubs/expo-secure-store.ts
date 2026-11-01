/**
 * Node test-environment stub for expo-secure-store.
 *
 * The real module is a native bridge that resolves into react-native, whose
 * Flow-only index.js cannot be parsed by Vitest/Rollup. Tests run in Node, so
 * this provides an in-memory keychain with the same surface used by
 * src/database/secure-storage.ts.
 */

const store = new Map<string, string>();

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';

export async function getItemAsync(key: string): Promise<string | null> {
  return store.has(key) ? (store.get(key) as string) : null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}
