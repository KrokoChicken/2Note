// Detects when the user has been removed from a doc and schedules a redirect, disconnecting the provider and double-checking via awareness/my-role API.

"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { fetchMyRole } from "@/lib/collab/api/docs";

export function useKickOnRemoval({
  slug, provider, role, redirectTo = "/dashboard", delayMs = 2000,
}: {
  slug: string;
  provider: any;
  role: "owner" | "editor" | "viewer" | "none";
  redirectTo?: string;
  delayMs?: number;
}) {
  const router = useRouter();
  const redirectTimerRef = React.useRef<number | null>(null);
  const [kicked, setKicked] = React.useState(false);

  React.useEffect(() => {
    if (role === "none" && redirectTimerRef.current == null) {
      setKicked(true);
      try { provider?.disconnect?.(); } catch {}
      redirectTimerRef.current = window.setTimeout(() => {
        router.replace(redirectTo);
      }, delayMs);
    }
    return () => {
      if (redirectTimerRef.current != null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [role, provider, router, redirectTo, delayMs]);

  const checkingRef = React.useRef(false);
  const checkMyRole = React.useCallback(async () => {
    if (checkingRef.current || redirectTimerRef.current != null) return;
    checkingRef.current = true;
    try {
      const next = await fetchMyRole(slug);
      if (next === "none" && redirectTimerRef.current == null) {
        setKicked(true);
        try { provider?.disconnect?.(); } catch {}
        redirectTimerRef.current = window.setTimeout(() => {
          router.replace(redirectTo);
        }, delayMs);
      }
    } finally { checkingRef.current = false; }
  }, [slug, provider, router, redirectTo, delayMs]);

  React.useEffect(() => {
    const aw = provider?.awareness;
    if (!aw?.on) { checkMyRole(); return; }
    let last = 0;
    const readMax = () => {
      let max = 0;
      for (const st of aw.getStates().values() as Iterable<any>) {
        const bump = Number((st as any)?.rolesBump) || 0;
        if (bump > max) max = bump;
      }
      return max;
    };
    last = readMax();
    const onUpdate = () => {
      const m = readMax();
      if (m > last) { last = m; setTimeout(checkMyRole, 80); }
    };
    aw.on("update", onUpdate);
    return () => aw.off?.("update", onUpdate);
  }, [provider, checkMyRole]);

  return kicked || role === "none" || redirectTimerRef.current != null;
}