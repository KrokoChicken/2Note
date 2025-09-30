// Returns a ref that triggers the callback if a click happens outside the referenced element.  

"use client";
import * as React from "react";
export function useOutsideClick<T extends HTMLElement>(onOutside: () => void) {
  const ref = React.useRef<T | null>(null);
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onOutside]);
  return ref;
}