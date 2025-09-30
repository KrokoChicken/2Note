// Tracks the current user's role in real time by refetching from the server and listening for awareness bumps, exposing role and canEdit status.

"use client";
import * as React from "react";
import { fetchMyRole } from "@/lib/collab/api/docs";

export function useMyRoleRealtime({
  slug, provider, initialRole, minIntervalMs = 1000,
}: {
  slug: string;
  provider: any;
  initialRole: "owner" | "editor" | "viewer";
  minIntervalMs?: number;
}) {
  const [role, setRole] = React.useState<"owner" | "editor" | "viewer" | "none">(initialRole);
  React.useEffect(() => setRole(initialRole), [initialRole]);

  const roleRef = React.useRef(role);
  React.useEffect(() => { roleRef.current = role; }, [role]);

  const lastTokenRef = React.useRef<string | null>(null);
  const inFlightRef = React.useRef(false);
  const lastFetchAtRef = React.useRef(0);

  const refetch = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (inFlightRef.current) return;
    if (!force && now - lastFetchAtRef.current < minIntervalMs) return;

    inFlightRef.current = true;
    lastFetchAtRef.current = now;
    try {
      const next = await fetchMyRole(slug);
      if (next === "none") { if (roleRef.current !== "none") setRole("none"); return; }
      if (next && next !== roleRef.current) setRole(next);
    } finally { inFlightRef.current = false; }
  }, [slug, minIntervalMs]);

  const readNewestBumpToken = React.useCallback((): string | null => {
    const aw = provider?.awareness;
    if (!aw?.getStates) return null;
    let newest: string | null = null;
    for (const st of aw.getStates().values() as Iterable<any>) {
      const token = (st as any)?.rolesBump;
      const t = token == null ? null : String(token);
      if (t && (!newest || t > newest)) newest = t;
    }
    return newest;
  }, [provider]);

  React.useEffect(() => {
    const aw = provider?.awareness;
    if (!aw?.on || !aw?.getStates) { refetch(true); return; }

    lastTokenRef.current = readNewestBumpToken();
    refetch(true);

    const onUpdate = () => {
      const newest = readNewestBumpToken();
      if (newest && newest !== lastTokenRef.current) {
        lastTokenRef.current = newest;
        refetch(true);
      }
    };
    aw.on("update", onUpdate);
    return () => aw.off?.("update", onUpdate);
  }, [provider, refetch, readNewestBumpToken]);

  return { role, canEdit: role === "owner" || role === "editor" };
}