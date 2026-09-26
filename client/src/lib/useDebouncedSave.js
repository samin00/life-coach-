import { useRef, useEffect, useCallback } from "react";

// Debounced persister for PATCH-style saves: schedule(patch, delay) merges into any pending
// patch (later keys win) and restarts the timer; delay 0 sends now. flush() sends pending now.
export function useDebouncedSave(save) {
  const timer = useRef(null);
  const pending = useRef(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    return p ? saveRef.current(p.payload) : Promise.resolve();
  }, []);

  const schedule = useCallback(
    (payload, delay = 0) => {
      pending.current = { payload: { ...(pending.current ? pending.current.payload : {}), ...payload } };
      if (timer.current) clearTimeout(timer.current);
      if (delay <= 0) return flush();
      timer.current = setTimeout(flush, delay);
      return undefined;
    },
    [flush]
  );

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);
  return { schedule, flush };
}
