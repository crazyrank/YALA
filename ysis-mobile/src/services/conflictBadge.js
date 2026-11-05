import { useEffect, useState } from 'react';

// One shared number for the red badge on the Conflicts tab.
// Any screen can update it, and the tab bar redraws at once.
let count = 0;
const listeners = new Set();

export function setConflictCount(n) {
  count = Number(n) || 0;
  listeners.forEach((fn) => fn(count));
}

export function useConflictCount() {
  const [value, setValue] = useState(count);
  useEffect(() => {
    listeners.add(setValue);
    setValue(count);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
