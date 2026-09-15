/**
 * store.ts — LocalStorage Persistence Wrapper
 *
 * Type-safe localStorage operations with JSON serialization.
 * Handles parse errors gracefully by returning defaults.
 */

const PREFIX = 'nairatax_';
const memoryStore = new Map<string, string>();

export function getStored<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    }
    const mem = memoryStore.get(PREFIX + key);
    if (!mem) return fallback;
    return JSON.parse(mem) as T;
  } catch {
    return fallback;
  }
}

export function setStored<T>(key: string, value: T): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return;
    }
    memoryStore.set(PREFIX + key, JSON.stringify(value));
  } catch {
    memoryStore.set(PREFIX + key, JSON.stringify(value));
  }
}

export function removeStored(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(PREFIX + key);
    }
    memoryStore.delete(PREFIX + key);
  } catch {
    memoryStore.delete(PREFIX + key);
  }
}

export function clearAll(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
    }
    memoryStore.clear();
  } catch {
    memoryStore.clear();
  }
}
