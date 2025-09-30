// Manages the live list of collaborators: syncs with server, listens for awareness updates, and handles optimistic role/remove actions with rollback on failure.

"use client";
import * as React from "react";
import { readNewestRolesToken, uniqueBumpToken } from "@/lib/collab/awareness";
import type { Collaborator, CollabProvider, Role } from "@/lib/collab/types";
import { fetchCollaborators, removeCollaborator, updateRole } from "@/lib/collab/api/collaborators";

export function useCollaborators(
  docSlug: string,
  provider: CollabProvider | null | undefined,
  initial: Collaborator[]
) {
  const [collabs, setCollabs] = React.useState<Collaborator[]>(initial);
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = React.useState(false);

  React.useEffect(() => setCollabs(initial), [initial]);

  // Stable setPending that does not depend on state identity
  const setPending = React.useCallback((id: string, val: boolean) => {
    setPendingIds(prev => {
      const next = new Set(prev);
      val ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  // Abortable refetch
  const abortRef = React.useRef<AbortController | null>(null);
  const refetch = React.useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsFetching(true);
    try {
      const data = await fetchCollaborators(docSlug); // (wrap to accept signal if you want)
      if (!ac.signal.aborted && data) setCollabs(data);
    } finally {
      if (!ac.signal.aborted) setIsFetching(false);
    }
  }, [docSlug]);

  // Awareness subscription with stable debounce
  React.useEffect(() => {
    const aw = provider?.awareness ?? undefined;
    let lastToken = aw ? readNewestRolesToken(aw) : null;
    let timer: number | null = null;

    const schedule = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(refetch, 100);
    };

    if (!aw?.on) {
      refetch();
      return () => {
        if (timer != null) window.clearTimeout(timer);
      };
    }

    refetch();

    const onUpdate = () => {
      const newest = readNewestRolesToken(aw);
      if (newest && newest !== lastToken) {
        lastToken = newest;
        schedule();
      }
    };

    aw.on("update", onUpdate);
    return () => {
      aw.off?.("update", onUpdate);
      if (timer != null) window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [provider, refetch]);

  const bumpRoles = React.useCallback(() => {
    provider?.awareness?.setLocalStateField?.("rolesBump", uniqueBumpToken());
  }, [provider]);

  const setRole = React.useCallback(
    async (u: Collaborator, role: Exclude<Role, "owner">, currentUserId: string, canManage: boolean) => {
      if (!canManage) return;
      if (u.role === role) return;
      if (u.id === currentUserId) { alert("You can’t change your own role here."); return; }
      if (u.role === "owner") { alert("Owners can’t be changed here."); return; }

      setCollabs(prev => prev.map(c => (c.id === u.id ? { ...c, role } : c)));
      setPending(u.id, true);

      try {
        await updateRole(docSlug, u.id, role);
        bumpRoles();
      } catch (err) {
        console.error(err);
        alert("Could not change role.");
        // rollback using functional update
        setCollabs(prev => prev.map(c => (c.id === u.id ? { ...c, role: u.role } : c)));
      } finally {
        setPending(u.id, false);
      }
    },
    [bumpRoles, docSlug, setPending]
  );

  const removeUser = React.useCallback(
    async (u: Collaborator, canManage: boolean) => {
      if (!canManage) return;
      if (!confirm(`Remove ${u.name} from this document?`)) return;

      // optimistic remove
      setCollabs(prev => prev.filter(c => c.id !== u.id));
      setPending(u.id, true);

      try {
        await removeCollaborator(docSlug, u.id);
        bumpRoles();
      } catch (err) {
        console.error(err);
        alert("Could not remove collaborator.");
        // rollback if failed
        setCollabs(prev => {
          const exists = prev.some(c => c.id === u.id);
          return exists ? prev : [...prev, u]; // reinsert if missing
        });
      } finally {
        setPending(u.id, false);
      }
    },
    [bumpRoles, docSlug, setPending]
  );

  return { collabs, setCollabs, refetch, pendingIds, isFetching, setRole, removeUser };
}