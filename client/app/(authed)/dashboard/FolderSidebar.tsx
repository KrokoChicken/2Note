"use client";

import * as React from "react";
import styles from "./FolderSidebar.module.css";

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
};

type Workspace = "personal" | "shared";

type Props = {
  folders: Folder[];
  activeFolderId: string | null; // null = All, "__none__" = Unfiled
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: () => void;
  onCreateSubfolder?: (parentId: string) => void;
  onRenameFolder: (id: string) => void;
  onDeleteFolder: (id: string) => void;

  // NEW: workspace switch lives here
  workspace: Workspace;
  onSwitchWorkspace: (ws: Workspace) => void;
};

export default function FolderSidebar({
  folders,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onCreateSubfolder,
  onRenameFolder,
  onDeleteFolder,
  workspace,
  onSwitchWorkspace,
}: Props) {
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);

  // Close kebab when clicking outside the menu
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el && el.closest(`.${styles.kebabWrap}`)) return;
      setMenuOpenId(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Build parent -> children map
  const byParent = React.useMemo(() => {
    const map = new Map<string | null, Folder[]>();
    for (const f of folders) {
      const key = f.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
      map.set(k, arr);
    }
    return map;
  }, [folders]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const Row: React.FC<{ f: Folder; level: number }> = ({ f, level }) => {
    const children = byParent.get(f.id) ?? [];
    const expanded = open.has(f.id);

    return (
      <div className={styles.treeRow} style={{ paddingLeft: level * 14 }}>
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

        <button
          type="button"
          className={`${styles.folderBtn} ${
            activeFolderId === f.id ? styles.folderActive : ""
          }`}
          title={f.name}
          onClick={() => onSelectFolder(f.id)}
        >
          📁 {f.name || "New folder"}
        </button>

        <div
          className={styles.kebabWrap}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.kebabBtn}
            aria-haspopup="menu"
            aria-expanded={menuOpenId === f.id}
            onClick={() => setMenuOpenId((cur) => (cur === f.id ? null : f.id))}
            title="Folder actions"
          >
            ⋮
          </button>
          {menuOpenId === f.id && (
            <ul role="menu" className={styles.kebabMenu}>
              <li role="menuitem">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpenId(null);
                    onRenameFolder(f.id);
                  }}
                >
                  Rename
                </button>
              </li>
              <li role="menuitem">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpenId(null);
                    onCreateSubfolder
                      ? onCreateSubfolder(f.id)
                      : onCreateFolder();
                  }}
                >
                  New subfolder
                </button>
              </li>
              <li role="menuitem">
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => {
                    setMenuOpenId(null);
                    onDeleteFolder(f.id);
                  }}
                >
                  Delete
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderTree = (parentId: string | null, level = 0): React.ReactNode => {
    const kids = byParent.get(parentId) ?? [];
    if (!kids.length) return null;
    return kids.map((f) => (
      <React.Fragment key={f.id}>
        <Row f={f} level={level} />
        {open.has(f.id) && renderTree(f.id, level + 1)}
      </React.Fragment>
    ));
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTop}>
        <div className={styles.wsToggle} role="tablist" aria-label="Workspace">
          <button
            type="button"
            role="tab"
            aria-selected={workspace === "personal"}
            className={`${styles.wsBtn} ${
              workspace === "personal" ? styles.wsActive : ""
            }`}
            onClick={() => onSwitchWorkspace("personal")}
            title="Personal workspace"
          >
            <span className={styles.wsIcon}>🏠</span> Personal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={workspace === "shared"}
            className={`${styles.wsBtn} ${
              workspace === "shared" ? styles.wsActive : ""
            }`}
            onClick={() => onSwitchWorkspace("shared")}
            title="Collaborative workspace"
          >
            <span className={styles.wsIcon}>👥</span> Collab
          </button>
        </div>

        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitle}>Folders</div>
          <button
            className={styles.sidebarNewBtn}
            onClick={onCreateFolder}
            type="button"
          >
            + New
          </button>
        </div>
      </div>

      {}
      <nav className={styles.folderNav}>
        <button
          type="button"
          className={`${styles.folderBtn} ${
            activeFolderId === null ? styles.folderActive : ""
          }`}
          onClick={() => onSelectFolder(null)}
          title="Show all documents"
        >
          <span className={styles.sideIcon}>📄</span> All documents
        </button>

        <button
          type="button"
          className={`${styles.folderBtn} ${
            activeFolderId === "__none__" ? styles.folderActive : ""
          }`}
          onClick={() => onSelectFolder("__none__")}
          title="Documents with no folder"
        >
          <span className={styles.sideIcon}>🗂️</span> Unfiled
        </button>

        <div className={styles.sectionDivider} />

        <div className={styles.folderTree}>{renderTree(null, 0)}</div>
      </nav>
    </aside>
  );
}
