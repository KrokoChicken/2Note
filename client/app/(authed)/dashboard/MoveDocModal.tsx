"use client";

import * as React from "react";
import styles from "./MoveDocModal.module.css";

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  docTitle: string;
  currentFolderId: string | null | undefined;
  folders: Folder[]; // pass folders for current workspace
  onConfirm: (folderId: string | null) => Promise<void>; // do the PATCH + local state update in parent
};

export default function MoveDocModal({
  open,
  onClose,
  docTitle,
  currentFolderId,
  folders,
  onConfirm,
}: Props) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | "__none__" | null>(
    currentFolderId ?? "__none__"
  );
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(currentFolderId ?? "__none__");
    }
  }, [open, currentFolderId]);

  const byParent = React.useMemo(() => {
    const map = new Map<string | null, Folder[]>();
    for (const f of folders) {
      if (query && !f.name.toLowerCase().includes(query.toLowerCase()))
        continue;
      const key = f.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
      map.set(k, arr);
    }
    return map;
  }, [folders, query]);

  const [openSet, setOpenSet] = React.useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpenSet((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const Row: React.FC<{ f: Folder; level: number }> = ({ f, level }) => {
    const children = byParent.get(f.id) ?? [];
    const expanded = openSet.has(f.id);
    return (
      <div className={styles.row} style={{ paddingLeft: level * 14 }}>
        <button
          type="button"
          className={styles.chevBtn}
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={() => toggle(f.id)}
          disabled={children.length === 0}
        >
          <span
            className={`${styles.chev} ${expanded ? styles.chevOpen : ""} ${
              children.length === 0 ? styles.chevHidden : ""
            }`}
          >
            ▶
          </span>
        </button>

        <label className={styles.folderOption}>
          <input
            type="radio"
            name="dest"
            checked={selected === f.id}
            onChange={() => setSelected(f.id)}
          />
          <span className={styles.folderIcon}>📁</span> {f.name}
        </label>
      </div>
    );
  };

  const renderTree = (parentId: string | null, level = 0): React.ReactNode => {
    const kids = byParent.get(parentId) ?? [];
    if (!kids.length) return null;
    return kids.map((f) => (
      <React.Fragment key={f.id}>
        <Row f={f} level={level} />
        {openSet.has(f.id) && renderTree(f.id, level + 1)}
      </React.Fragment>
    ));
  };

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm(selected === "__none__" ? null : (selected as string));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-title"
      >
        <div className={styles.header}>
          <h3 id="move-title" className={styles.title}>
            Move “{docTitle}”
          </h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <input
          className={styles.search}
          placeholder="Search folders…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className={styles.unfiledRow}>
          <label className={styles.folderOption}>
            <input
              type="radio"
              name="dest"
              checked={selected === "__none__"}
              onChange={() => setSelected("__none__")}
            />
            <span className={styles.folderIcon}>🗂️</span> Unfiled
          </label>
        </div>

        <div className={styles.tree}>{renderTree(null, 0)}</div>

        <div className={styles.footer}>
          <button
            className={styles.secondaryBtn}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className={styles.primaryBtn}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Moving…" : "Move"}
          </button>
        </div>
      </div>
    </div>
  );
}
