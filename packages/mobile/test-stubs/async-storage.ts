/**
 * Node test-environment stub for @react-native-async-storage/async-storage.
 *
 * The real package's ESM build imports `react-native`, whose Flow-only
 * index.js cannot be parsed by Vitest/Rollup. Tests in this package run in
 * Node, so an in-memory store with the same default-export API is used.
 */

const store = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return store.has(key) ? (store.get(key) as string) : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  async clear(): Promise<void> {
    store.clear();
  },
  async getAllKeys(): Promise<string[]> {
    return Array.from(store.keys());
  },
  async multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
    return keys.map((k) => [k, store.has(k) ? (store.get(k) as string) : null]);
  },
  async multiSet(pairs: Array<[string, string]>): Promise<void> {
    for (const [k, v] of pairs) store.set(k, v);
  },
  async multiRemove(keys: string[]): Promise<void> {
    for (const k of keys) store.delete(k);
  },
};

export default AsyncStorage;
