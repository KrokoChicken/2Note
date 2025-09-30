// Manages the lifecycle of a collab room: acquires the provider, sets local user presence, cleans up on page exit, and releases resources on unmount.

"use client";
import * as React from "react";
import { acquireProvider, releaseProvider, setLocalUser } from "@/lib/collab/registry";

export function useCollabRoomLifecycle({
  slug, wsUrl, currentUserId, userName, color = "#4f46e5",
}: {
  slug: string; wsUrl: string; currentUserId: string; userName: string; color?: string;
}) {
  const room = React.useMemo(() => acquireProvider(slug, wsUrl), [slug, wsUrl]);

  React.useEffect(() => {
    setLocalUser(slug, wsUrl, { id: currentUserId, name: userName, color });
  }, [slug, wsUrl, currentUserId, userName, color]);

  React.useEffect(() => {
    const clearPresenceNow = () => {
      try { (room.provider as any)?.awareness?.setLocalState(null); } catch {}
    };
    window.addEventListener("beforeunload", clearPresenceNow);
    window.addEventListener("pagehide", clearPresenceNow);
    return () => {
      window.removeEventListener("beforeunload", clearPresenceNow);
      window.removeEventListener("pagehide", clearPresenceNow);
    };
  }, [room.provider]);

  React.useEffect(() => () => releaseProvider(room.key), [room.key]);

  return room; // { provider, ydoc, key }
}