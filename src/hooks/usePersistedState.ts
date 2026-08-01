/**
 * usePersistedState.ts — Drop-in useState replacement with localStorage persistence
 *
 * Usage: const [value, setValue] = usePersistedState('key', defaultValue);
 * Survives page refreshes. Uses store.ts under the hood.
 */

import { useState, useCallback } from 'react';
import { getStored, setStored } from '../utils/store';

export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setStateRaw] = useState<T>(() => getStored(key, defaultValue));

  const setState = useCallback((value: T | ((prev: T) => T)) => {
    setStateRaw((prev) => {
      const next = value instanceof Function ? value(prev) : value;
      setStored(key, next);
      return next;
    });
  }, [key]);

  return [state, setState];
}
