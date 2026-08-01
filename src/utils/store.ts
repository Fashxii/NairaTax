/**
 * store.ts — LocalStorage Persistence Wrapper
 *
 * Type-safe localStorage operations with JSON serialization.
 * Handles parse errors gracefully by returning defaults.
 */

const PREFIX = 'nairatax_';

export function getStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

export function removeStored(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

export function clearAll(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
  keys.forEach(k => localStorage.removeItem(k));
}
