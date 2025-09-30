// components/collab/RoleMenu.tsx
"use client";

import * as React from "react";
import styles from "./CollabPanel.module.css";
import type { Role } from "@/lib/collab/types";

type Props = {
  id: string;
  name: string;
  role: Role;
  pending: boolean;
  onMakeViewer: () => void;
  onMakeEditor: () => void;
  onRemove: () => void;
};

export default function RoleMenu({
  id,
  name,
  role,
  pending,
  onMakeViewer,
  onMakeEditor,
  onRemove,
}: Props) {
  const isOwner = role === "owner";

  return (
    <div
      id={`menu-${id}`}
      role="menu"
      aria-label={`Actions for ${name}`}
      className={styles.menu}
    >
      <button
        role="menuitemradio"
        aria-checked={role === "viewer"}
        className={styles.menuItem}
        onClick={onMakeViewer}
        disabled={pending || isOwner}
        title={isOwner ? "Owner role cannot be changed here" : "Make viewer"}
        type="button"
      >
        Make viewer
      </button>

      <button
        role="menuitemradio"
        aria-checked={role === "editor"}
        className={styles.menuItem}
        onClick={onMakeEditor}
        disabled={pending || isOwner}
        title={isOwner ? "Owner role cannot be changed here" : "Make editor"}
        type="button"
      >
        Make editor
      </button>

      <div className={styles.menuDivider} />

      <button
        role="menuitem"
        className={`${styles.menuItem} ${styles.menuDanger}`}
        onClick={onRemove}
        disabled={pending || isOwner}
        title={isOwner ? "Owner cannot be removed" : "Remove from doc"}
        type="button"
      >
        Remove from doc
      </button>
    </div>
  );
}
