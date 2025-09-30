"use client";

import * as React from "react";
import Image from "next/image";
import styles from "./CollabPanel.module.css";
import { useCollabRoom } from "@/lib/collab/CollabRoomContext";

import type { Role } from "@/lib/collab/types";
import { useOnlinePresence } from "@/lib/collab/hooks/useOnlinePresence";
import { useCollaborators } from "@/lib/collab/hooks/useCollaborators";
import { useSortedCollaborators } from "@/lib/collab/hooks/useSortedCollaborators";
import { useSingleOpenId } from "@/lib/collab/hooks/useSingleOpenId";
import { useOutsideClick } from "@/lib/collab/hooks/useOutsideClick";

import RoleMenu from "./RoleMenu";

type Props = {
  docSlug: string;
  initial: any[]; // or Collaborator[]
  /** kept for backwards-compat; we derive live role from list */
  isOwner: boolean;
  currentUserId: string;
};

export default function CollaboratorsPanel({
  docSlug,
  initial,
  isOwner,
  currentUserId,
}: Props) {
  const { provider } = useCollabRoom();

  // presence
  const { mounted, onlineIds, awarenessReady } = useOnlinePresence(provider);

  // collaborators state + actions
  const { collabs, pendingIds, setRole, removeUser } = useCollaborators(
    docSlug,
    provider,
    initial
  );

  // my role (derived)
  const selfRole: Role = React.useMemo(() => {
    return (
      collabs.find((c) => c.id === currentUserId)?.role ??
      (isOwner ? "owner" : "viewer")
    );
  }, [collabs, currentUserId, isOwner]);
  const canManage = selfRole === "owner";

  // sorted list
  const list = useSortedCollaborators(collabs, onlineIds, awarenessReady);

  // kebab open state + outside click
  const { openId, setOpenId } = useSingleOpenId();
  const panelRef = useOutsideClick<HTMLDivElement>(() => setOpenId(null));

  return (
    <aside ref={panelRef} className={styles.panel} aria-label="Collaborators">
      <div className={styles.card}>
        <div className={styles.row}>
          <h3 className={styles.title}>Collaborators</h3>
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

                {canManage && !isYou && (
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
                      <RoleMenu
                        id={u.id}
                        name={u.name}
                        role={u.role}
                        pending={pending}
                        onMakeViewer={() =>
                          setRole(u, "viewer", currentUserId, canManage)
                        }
                        onMakeEditor={() =>
                          setRole(u, "editor", currentUserId, canManage)
                        }
                        onRemove={() => removeUser(u, canManage)}
                      />
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
