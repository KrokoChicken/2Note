// /app/(dashboard)/DocListItem.tsx
"use client";

import * as React from "react";
import styles from "./DocListItem.module.css";

type Doc = {
  slug: string;
  title: string;
  updatedAtText: string;
  isOwner: boolean;
  folderName?: string | null; // 👈 NEW
};

export default function DocListItem({
  doc,
  onOpen,
  onRemoved,
  onRenamed,
  onMoveRequest,
  showFolderName = false, // 👈 NEW: show folder chip when true
}: {
  doc: Doc;
  onOpen: () => void;
  onRemoved: () => void;
  onRenamed?: (newTitle: string) => void;
  onMoveRequest: () => void;
  showFolderName?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  // Close on outside click / Esc
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  // Focus first menu item on open
  React.useEffect(() => {
    if (!menuOpen) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>("[data-menuitem]")
      ?.focus();
  }, [menuOpen]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((p) => !p);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this document for everyone? This cannot be undone."))
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/docs/${doc.slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      onRemoved();
    } catch (err) {
      console.error(err);
      alert("Could not delete the document.");
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm("Remove this shared document from your list?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/docs/${doc.slug}/membership`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove from list");
      onRemoved();
    } catch (err) {
      console.error(err);
      alert("Could not remove the document from your list.");
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  const handleRename = async () => {
    const newTitle = prompt("Enter new title:", doc.title);
    if (!newTitle || newTitle === doc.title) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/docs/${doc.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!res.ok) throw new Error("Failed to rename");
      onRenamed?.(newTitle);
    } catch (err) {
      console.error(err);
      alert("Could not rename document.");
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  // Keyboard nav inside menu
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("[data-menuitem]") ??
        []
    );
    const idx = items.findIndex((el) => el === document.activeElement);
    const move = (i: number) => items[i]?.focus();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(idx < items.length - 1 ? idx + 1 : 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(idx > 0 ? idx - 1 : items.length - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(items.length - 1);
        break;
      case "Tab":
        e.preventDefault(); // trap focus
        if (e.shiftKey) move(idx > 0 ? idx - 1 : items.length - 1);
        else move(idx < items.length - 1 ? idx + 1 : 0);
        break;
    }
  };

  return (
    <li className={styles.item} onClick={onOpen} aria-busy={busy}>
      <div className={styles.main}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{doc.title}</span>
          <span
            className={doc.isOwner ? styles.badgeOwner : styles.badgeShared}
          >
            {doc.isOwner ? "Owner" : "Shared"}
          </span>
        </div>

        <div className={styles.metaRow}>
          <div className={styles.meta}>Updated {doc.updatedAtText}</div>
          {showFolderName && !!doc.folderName && (
            <span className={styles.folderChip} title={doc.folderName}>
              📁 {doc.folderName}
            </span>
          )}
        </div>
      </div>

      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        <button
          ref={btnRef}
          className={styles.kebabBtn}
          onClick={openMenu}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={`menu-${doc.slug}`}
          title="More actions"
        >
          ⋯
        </button>

        {menuOpen && (
          <div
            id={`menu-${doc.slug}`}
            ref={menuRef}
            className={styles.menu}
            role="menu"
            aria-labelledby={`btn-${doc.slug}`}
            onKeyDown={onMenuKeyDown}
          >
            <div className={styles.menuArrow} aria-hidden />
            {doc.isOwner && (
              <button
                data-menuitem
                role="menuitem"
                className={styles.menuItem}
                onClick={handleRename}
              >
                ✏️ Rename
              </button>
            )}

            <button
              data-menuitem
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                setMenuOpen(false);
                onMoveRequest();
              }}
            >
              📁 Move to…
            </button>

            <div className={styles.menuDivider} />

            <button
              data-menuitem
              role="menuitem"
              className={`${styles.menuItem} ${styles.danger}`}
              onClick={doc.isOwner ? handleDelete : handleLeave}
              disabled={busy}
            >
              {doc.isOwner ? "🗑 Delete" : "➖ Remove"}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
