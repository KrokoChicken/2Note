"use client";

import { useState } from "react";
import styles from "./DocListItem.module.css";

type Doc = {
  slug: string;
  title: string;
  updatedAtText: string;
  isOwner: boolean;
};

export default function DocListItem({
  doc,
  onOpen,
  onRemoved,
  onRenamed,
  onMoveRequest,
}: {
  doc: Doc;
  onOpen: () => void;
  onRemoved: () => void;
  onRenamed?: (newTitle: string) => void;
  onMoveRequest: () => void; // NEW
}) {
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
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
        <div className={styles.meta}>Updated {doc.updatedAtText}</div>
      </div>

      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.menuButton}
          onClick={toggleMenu}
          aria-expanded={menuOpen}
        >
          ⋮
        </button>
        {menuOpen && (
          <ul className={styles.menu}>
            {doc.isOwner && <li onClick={handleRename}>Rename</li>}
            <li onClick={onMoveRequest}>Move to…</li>
            <li onClick={doc.isOwner ? handleDelete : handleLeave}>
              {doc.isOwner ? "Delete" : "Remove"}
            </li>
          </ul>
        )}
      </div>
    </li>
  );
}
