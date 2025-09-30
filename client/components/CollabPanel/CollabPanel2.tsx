"use client";

import * as React from "react";
import Image from "next/image";
import styles from "./CollabPanel.module.css";
import { useCollabRoom } from "@/lib/collab/CollabRoomContext";

/* ---------------------------------- */
/* Types                               */
/* ---------------------------------- */

export type Role = "owner" | "editor" | "viewer";
export type Collaborator = {
  id: string;
  name: string;
  image: string | null;
  role: Role;
};

type Props = {
  docSlug: string;
  initial: Collaborator[];
  /** kept for backwards-compat; we derive live role from list */
  isOwner: boolean;
  currentUserId: string;
};

/* ---------------------------------- */
/* Small utilities                     */
/* ---------------------------------- */

const EMPTY_SET: ReadonlySet<string> = new Set();

function uniqueBumpToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readOnlineIdsFromAwareness(aw?: any): ReadonlySet<string> {
  if (!aw?.getStates) return EMPTY_SET;
  const ids = new Set<string>();
  for (const s of aw.getStates().values() as Iterable<any>) {
    const id = s?.user?.id ?? s?.userId;
    if (id != null) ids.add(String(id));
  }
  return ids;
}

function readNewestRolesToken(aw: any): string | null {
  if (!aw?.getStates) return null;
  let newest: string | null = null;
  for (const st of aw.getStates().values() as Iterable<any>) {
    const t = typeof st?.rolesBump === "string" ? st.rolesBump : null;
    if (t && (!newest || t > newest)) newest = t; // lexical compare
  }
  return newest;
}

/* ---------------------------------- */
/* Hooks                               */
/* ---------------------------------- */

/** Online presence with hydration-safe server snapshot & stable subscribe. */
function useOnlinePresence(provider: any) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const aw = provider?.awareness;

  // Keep the latest snapshot in a ref so the identity is stable between reads
  const snapshotRef = React.useRef<ReadonlySet<string>>(EMPTY_SET);

  const setsEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
    if (a === b) return true;
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  };

  // Subscribe/unsubscribe from awareness events. Only notify when the snapshot actually changes.
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (!aw?.on || !aw?.off) return () => {};

      const handler = () => {
        const next = mounted ? readOnlineIdsFromAwareness(aw) : EMPTY_SET;
        if (!setsEqual(snapshotRef.current, next)) {
          snapshotRef.current = next;
          onStoreChange();
        }
      };

      // Initialize once at subscribe time to avoid returning brand-new objects later
      handler();
      aw.on("update", handler);
      return () => aw.off("update", handler);
    },
    [aw, mounted]
  );

  // Return the cached snapshot (stable identity until it really changes)
  const getSnapshot = React.useCallback(() => snapshotRef.current, []);

  // Server snapshot MUST be stable to avoid loops during SSR/rehydration
  const getServerSnapshot = React.useCallback(() => EMPTY_SET, []);

  const onlineIds = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  // Small readiness gate to avoid initial flicker
  const [awarenessReady, setAwarenessReady] = React.useState(false);
  React.useEffect(() => {
    if (!awarenessReady) {
      const t = window.setTimeout(() => setAwarenessReady(true), 120);
      return () => window.clearTimeout(t);
    }
  }, [awarenessReady, onlineIds]);

  return { mounted, onlineIds, awarenessReady };
}

/** Collaborators list with optimistic updates + awareness-driven refetch. */
function useCollaborators(
  docSlug: string,
  provider: any,
  initial: Collaborator[]
) {
  const [collabs, setCollabs] = React.useState<Collaborator[]>(initial);

  // keep in sync if initial prop changes
  React.useEffect(() => setCollabs(initial), [initial]);

  const refetch = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/docs/${encodeURIComponent(docSlug)}/collaborators`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.collaborators)) {
        setCollabs(data.collaborators as Collaborator[]);
      }
    } catch {
      // ignore
    }
  }, [docSlug]);

  // react to rolesBump token changes
  React.useEffect(() => {
    const aw = provider?.awareness;
    if (!aw?.on) {
      refetch();
      return;
    }
    let lastToken = readNewestRolesToken(aw);
    refetch();

    const onUpdate = () => {
      const newest = readNewestRolesToken(aw);
      if (newest && newest !== lastToken) {
        lastToken = newest;
        window.setTimeout(refetch, 100); // small debounce
      }
    };

    aw.on("update", onUpdate);
    return () => aw.off?.("update", onUpdate);
  }, [provider, refetch]);

  return { collabs, setCollabs, refetch };
}

/** Stable sorting: online (if ready) → owner → name → id */
function useSortedList(
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

/* ---------------------------------- */
/* Component                           */
/* ---------------------------------- */

export default function CollaboratorsPanel({
  docSlug,
  initial,
  isOwner, // legacy fallback
  currentUserId,
}: Props) {
  const { provider } = useCollabRoom();

  // presence
  const { mounted, onlineIds, awarenessReady } = useOnlinePresence(provider);

  // collaborators
  const { collabs, setCollabs } = useCollaborators(docSlug, provider, initial);

  // my role (derived)
  const selfRole: Role = React.useMemo(() => {
    return (
      collabs.find((c) => c.id === currentUserId)?.role ??
      (isOwner ? "owner" : "viewer")
    );
  }, [collabs, currentUserId, isOwner]);
  const canManage = selfRole === "owner";

  // sorted list
  const list = useSortedList(collabs, onlineIds, awarenessReady);

  // pending per-user state
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
  const setPending = React.useCallback((id: string, val: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      val ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  // one open kebab at a time
  const [openId, setOpenId] = React.useState<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const root = panelRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // awareness notifier
  const bumpRoles = React.useCallback(() => {
    const aw = provider?.awareness;
    aw?.setLocalStateField?.("rolesBump", uniqueBumpToken());
  }, [provider]);

  /* ------------ Actions (optimistic) ------------ */

  async function setRole(u: Collaborator, role: Exclude<Role, "owner">) {
    if (!canManage) return;
    if (u.role === role) {
      setOpenId(null);
      return;
    }
    if (u.id === currentUserId) {
      alert("You can’t change your own role here.");
      return;
    }
    if (u.role === "owner") {
      alert("Owners can’t be changed here.");
      return;
    }

    const prev = collabs;
    const next = prev.map((c) => (c.id === u.id ? { ...c, role } : c));
    setCollabs(next);
    setOpenId(null);
    setPending(u.id, true);

    try {
      const res = await fetch(
        `/api/docs/${encodeURIComponent(
          docSlug
        )}/collaborators/${encodeURIComponent(u.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }
      );
      if (!res.ok) {
        throw new Error(
          (await res.json().catch(() => ({})))?.error || "Failed to update role"
        );
      }
      bumpRoles();
    } catch (err) {
      console.error(err);
      alert("Could not change role.");
      setCollabs(prev); // rollback
    } finally {
      setPending(u.id, false);
    }
  }

  async function removeUser(u: Collaborator) {
    if (!canManage) return;
    if (!confirm(`Remove ${u.name} from this document?`)) return;

    const prev = collabs;
    const next = prev.filter((c) => c.id !== u.id);
    setCollabs(next);
    setOpenId(null);
    setPending(u.id, true);

    try {
      const res = await fetch(
        `/api/docs/${encodeURIComponent(
          docSlug
        )}/collaborators/${encodeURIComponent(u.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw new Error(
          (await res.json().catch(() => ({})))?.error ||
            "Failed to remove collaborator"
        );
      }
      bumpRoles();
    } catch (err) {
      console.error(err);
      alert("Could not remove collaborator.");
      setCollabs(prev); // rollback
    } finally {
      setPending(u.id, false);
    }
  }

  /* ------------ Render ------------ */

  return (
    <aside ref={panelRef} className={styles.panel} aria-label="Collaborators">
      <div className={styles.card}>
        <div className={styles.row}>
          <h3 className={styles.title}>Collaborators</h3>
          {/* Hydration-safe counter */}
          <span className={styles.count} suppressHydrationWarning>
            {mounted ? `${onlineIds.size} online` : "—"}
          </span>
        </div>

        <ul className={styles.list}>
          {list.map((u) => {
            const online = awarenessReady && onlineIds.has(u.id);
            const isYou = u.id === currentUserId;
            const menuOpen = openId === u.id;
            const pending = pendingIds.has(u.id);

            return (
              <li key={u.id} className={styles.item} aria-busy={pending}>
                <span
                  className={`${styles.dot} ${online ? styles.on : styles.off}`}
                  aria-hidden="true"
                />

                {u.image ? (
                  <Image
                    src={u.image}
                    alt=""
                    width={20}
                    height={20}
                    className={styles.avatar}
                  />
                ) : (
                  <span className={styles.avatarFallback}>
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                )}

                <div className={styles.meta}>
                  <span className={styles.name}>
                    {u.name}
                    {isYou && <span className={styles.you}>you</span>}
                    {pending && (
                      <span className={styles.pendingDot} aria-hidden>
                        •
                      </span>
                    )}
                  </span>
                  <span className={styles.sub} suppressHydrationWarning>
                    {u.role}
                    {mounted && awarenessReady
                      ? online
                        ? " • online"
                        : " • offline"
                      : ""}
                  </span>
                </div>

                {selfRole === "owner" && !isYou && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.kebabBtn}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen ? "true" : "false"}
                      aria-controls={`menu-${u.id}`}
                      onClick={() => setOpenId(menuOpen ? null : u.id)}
                      onKeyDown={(e) => e.key === "Escape" && setOpenId(null)}
                      title="Member actions"
                      disabled={pending}
                    >
                      <span className={styles.kebabDots} aria-hidden="true">
                        ⋮
                      </span>
                      <span className="sr-only"></span>
                    </button>

                    {menuOpen && (
                      <div
                        id={`menu-${u.id}`}
                        role="menu"
                        aria-label={`Actions for ${u.name}`}
                        className={styles.menu}
                      >
                        <button
                          role="menuitemradio"
                          aria-checked={u.role === "viewer"}
                          className={styles.menuItem}
                          onClick={() => setRole(u, "viewer")}
                          disabled={pending || u.role === "owner"}
                          title={
                            u.role === "owner"
                              ? "Owner role cannot be changed here"
                              : "Make viewer"
                          }
                        >
                          Make viewer
                        </button>
                        <button
                          role="menuitemradio"
                          aria-checked={u.role === "editor"}
                          className={styles.menuItem}
                          onClick={() => setRole(u, "editor")}
                          disabled={pending || u.role === "owner"}
                          title={
                            u.role === "owner"
                              ? "Owner role cannot be changed here"
                              : "Make editor"
                          }
                        >
                          Make editor
                        </button>
                        <div className={styles.menuDivider} />
                        <button
                          role="menuitem"
                          className={`${styles.menuItem} ${styles.menuDanger}`}
                          onClick={() => removeUser(u)}
                          disabled={pending || u.role === "owner"}
                          title={
                            u.role === "owner"
                              ? "Owner cannot be removed"
                              : "Remove from doc"
                          }
                        >
                          Remove from doc
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
