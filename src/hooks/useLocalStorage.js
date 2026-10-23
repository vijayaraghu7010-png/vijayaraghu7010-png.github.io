import { useCallback, useEffect, useRef, useState } from 'react';

/* State that survives a reload. Reads and writes are guarded because
   storage throws in private windows and when site data is blocked. */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      /* storage unavailable — the app still works for this session */
    }
  }, [value]);

  const reset = useCallback(() => setValue(initialValue), [initialValue]);

  return [value, setValue, reset];
}

export default useLocalStorage;
