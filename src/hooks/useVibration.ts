import { useCallback, useRef } from 'react';

export function useVibration(enabled: boolean) {
  const supportedRef = useRef(typeof navigator !== 'undefined' && 'vibrate' in navigator);

  const vibrate = useCallback(
    (pattern: number | number[]) => {
      if (!enabled || !supportedRef.current) return;
      navigator.vibrate(pattern);
    },
    [enabled]
  );

  return { vibrate, supported: supportedRef.current };
}
