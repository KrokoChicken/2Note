// Returns collaborators sorted by online status (if ready), then owner role, then name, then id for stable display.  

"use client";
import * as React from "react";
import type { Collaborator } from "@/lib/collab/types";

export function useSortedCollaborators(
  collabs: Collaborator[],
  onlineIds: ReadonlySet<string>,
  awarenessReady: boolean
) {
  return React.useMemo(() => {
    return [...collabs].sort((a, b) => {
      if (awarenessReady) {
        const ao = onlineIds.has(a.id) ? 0 : 1;
        const bo = onlineIds.has(b.id) ? 0 : 1;
        if (ao !== bo) return ao - bo;
      }
      const aOwner = a.role === "owner" ? 0 : 1;
      const bOwner = b.role === "owner" ? 0 : 1;
      if (aOwner !== bOwner) return aOwner - bOwner;

      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) return byName;

      return a.id.localeCompare(b.id);
    });
  }, [collabs, onlineIds, awarenessReady]);
}