"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "driveedge_compare";
const MAX = 4;

function read(): number[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function useCompare() {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    setIds(read());
    const handler = () => setIds(read());
    window.addEventListener("storage", handler);
    window.addEventListener("driveedge-compare", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("driveedge-compare", handler);
    };
  }, []);

  const persist = useCallback((next: number[]) => {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("driveedge-compare"));
    setIds(next);
  }, []);

  const toggle = useCallback(
    (id: number) => {
      const current = read();
      if (current.includes(id)) {
        persist(current.filter((x) => x !== id));
      } else if (current.length < MAX) {
        persist([...current, id]);
      }
    },
    [persist]
  );

  const clear = useCallback(() => persist([]), [persist]);

  const setAll = useCallback((next: number[]) => persist(next.slice(0, MAX)), [persist]);

  return { ids, toggle, clear, setAll, max: MAX };
}
