import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';

const subscribe = (onChange: () => void) => {
  const list = window.matchMedia(query);
  list.addEventListener('change', onChange);
  return () => {
    list.removeEventListener('change', onChange);
  };
};

/** Follows the OS "reduce motion" setting, live. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
