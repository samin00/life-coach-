import { useRef, useEffect, useCallback } from "react";

// Debounced persister for PATCH-style saves: schedule(patch, delay) merges into any pending
// patch (later keys win) and restarts the timer; delay 0 sends now. flush() sends pending now
// and rejects if the save fails. saveOnUnload(payload) (optional) sends anything still pending
// on pagehide, e.g. with fetch keepalive.
const noop = () => {};

export function useDebouncedSave(save, saveOnUnload) {
  const timer = useRef(null);
  const pending = useRef(null);
  const saveRef = useRef(save);
  const unloadRef = useRef(saveOnUnload);
  saveRef.current = save;
  unloadRef.current = saveOnUnload;

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
      if (delay <= 0) return flush().catch(noop); // save() already reported the error
      timer.current = setTimeout(() => flush().catch(noop), delay);
      return undefined;
    },
    [flush]
  );

  useEffect(() => {
    const onHide = () => {
      const p = pending.current;
      if (!p || !unloadRef.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      unloadRef.current(p.payload).catch(noop);
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  return { schedule, flush };
}
