import { useCallback, useEffect, useRef, useState } from 'react';

type Updater<T> = T | ((prev: T) => T);

const isBrowser = typeof window !== 'undefined';

export function useLocalStore<T>(key: string, initialValue: T) {
  const initialRef = useRef(initialValue);
  const [value, setValue] = useState<T>(() => {
    if (!isBrowser) {
      return initialRef.current;
    }
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch (error) {
      console.warn(`Failed to parse localStorage key "${key}"`, error);
    }
    return initialRef.current;
  });

  useEffect(() => {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to write localStorage key "${key}"`, error);
    }
  }, [key, value]);

  const update = useCallback(
    (next: Updater<T>) => {
      setValue(prev => {
        const result = typeof next === 'function' ? (next as (arg: T) => T)(prev) : next;
        return result;
      });
    },
    []
  );

  return [value, update] as const;
}
