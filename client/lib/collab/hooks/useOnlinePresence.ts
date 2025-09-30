// Tracks which users are currently online via awareness, exposing a hydration-safe onlineIds set and a readiness flag to avoid flicker.

"use client";
import * as React from "react";
import { EMPTY_SET, readOnlineIdsFromAwareness } from "@/lib/collab/awareness";
import type { CollabProvider } from "@/lib/collab/types";

export function useOnlinePresence(provider?: CollabProvider) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const aw = provider?.awareness ?? undefined;
  const snapshotRef = React.useRef<ReadonlySet<string>>(EMPTY_SET);

  const setsEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
    if (a === b) return true;
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  };

  const subscribe = React.useCallback((onStoreChange: () => void) => {
    if (!aw?.on || !aw?.off) return () => {};
    const handler = () => {
      const next = mounted ? readOnlineIdsFromAwareness(aw) : EMPTY_SET;
      if (!setsEqual(snapshotRef.current, next)) {
        snapshotRef.current = next;
        onStoreChange();
      }
    };
    handler();
    aw.on("update", handler);
    return () => aw.off!("update", handler);
  }, [aw, mounted]);

  const getSnapshot = React.useCallback(() => snapshotRef.current, []);
  const getServerSnapshot = React.useCallback(() => EMPTY_SET, []);

  const onlineIds = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [awarenessReady, setAwarenessReady] = React.useState(false);
  React.useEffect(() => {
    if (!awarenessReady) {
      const t = window.setTimeout(() => setAwarenessReady(true), 120);
      return () => window.clearTimeout(t);
    }
  }, [awarenessReady, onlineIds]);

  return { mounted, onlineIds, awarenessReady };
}