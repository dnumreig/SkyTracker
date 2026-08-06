"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const STORAGE_KEY = "skytracker.showDependencies";

const DepsCtx = createContext<{ show: boolean; toggle: () => void }>({
  show: true,
  toggle: () => {},
});

/** Shares "are dependency lines visible?" between the header toggle and the board overlay.
 *  Defaults to shown; the user's choice persists across reloads via localStorage. */
export function DepsProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setShow(stored === "1");
  }, []);

  const toggle = useCallback(() => {
    setShow((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return <DepsCtx.Provider value={{ show, toggle }}>{children}</DepsCtx.Provider>;
}

export function useDepsVisible() {
  return useContext(DepsCtx);
}

export function DepsToggleButton() {
  const { show, toggle } = useDepsVisible();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={show}
      title={show ? "Hide dependency lines" : "Show dependency lines"}
      className={`text-xs font-medium rounded px-2 py-1 border transition ${
        show
          ? "border-ocean-5 bg-ocean-5/20 text-ocean-1 dark:text-skyblue-1"
          : "border-slate-300 dark:border-ocean-4 text-slate-500 dark:text-ocean-6 hover:text-ocean-1 dark:hover:text-skyblue-1"
      }`}
    >
      Dependencies: {show ? "On" : "Off"}
    </button>
  );
}
