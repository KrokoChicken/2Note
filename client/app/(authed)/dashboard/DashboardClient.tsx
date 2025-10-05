// /app/(dashboard)/DashboardClient.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NewDocButton from "./NewDocButton";
import DocList from "./DocList";
import styles from "./DashboardClient.module.css";
import FolderSidebar, { type Folder } from "./FolderSidebar";

/* ---------------- Types ---------------- */
type Mode = "personal" | "shared";

type Doc = {
  id: string;
  slug: string;
  title: string;
  updated_at: string;
  updatedAtText: string;
  isOwner: boolean;
  mode?: Mode;
  folderId?: string | null;
};

/* -------------- Helpers ---------------- */
const tempId = () => `temp_${Math.random().toString(36).slice(2, 10)}`;

/* ------------- Main Dashboard ---------- */
export default function DashboardClient({
  userName,
  docs: initialDocs,
}: {
  userName: string;
  docs: Doc[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  // Mode tab from URL ?mode=personal|shared
  const urlMode =
    (params.get("mode") as Mode) === "shared" ? "shared" : "personal";
  const [mode, setMode] = React.useState<Mode>(urlMode);

  const [docs, setDocs] = React.useState<Doc[]>(initialDocs);

  // Folder state
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = React.useState<string | null>(
    null
  ); // null = All, "__none__" = Unfiled

  // Keep URL in sync for mode only (folder selection is local UI state)
  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url);
  }, [mode]);

  // Fetch folders once
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/folders", { cache: "no-store" });
        if (!r.ok) throw new Error("Failed to fetch folders");
        const data = await r.json();
        if (!cancelled) setFolders(data.folders ?? data ?? []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Create root folder (optimistic)
  const onCreateFolder = React.useCallback(async () => {
    const raw = prompt("Folder name?");
    const name = (raw ?? "").trim();
    if (!name) return;

    const tmp: Folder = { id: tempId(), name, parentId: null };
    setFolders((prev) => [...prev, tmp]);
    setActiveFolderId(tmp.id);

    try {
      const r = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: null }),
      });
      if (!r.ok) throw new Error("Failed to create folder");
      const payload = await r.json();
      const created: Folder = payload.folder ?? payload;

      setFolders((prev) =>
        prev.map((f) =>
          f.id === tmp.id ? { ...f, id: created.id, name: created.name } : f
        )
      );
      setActiveFolderId(created.id);
    } catch (e) {
      console.error(e);
      setFolders((prev) => prev.filter((f) => f.id !== tmp.id));
      alert("Could not create folder.");
    }
  }, []);

  // Create subfolder (optimistic)
  const onCreateSubfolder = React.useCallback(async (parentId: string) => {
    const raw = prompt("Subfolder name?");
    const name = (raw ?? "").trim();
    if (!name) return;

    const tmp: Folder = { id: tempId(), name, parentId };
    setFolders((prev) => [...prev, tmp]);
    setActiveFolderId(tmp.id);

    try {
      const r = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId }),
      });
      if (!r.ok) throw new Error("Failed to create subfolder");
      const payload = await r.json();
      const created: Folder = payload.folder ?? payload;

      setFolders((prev) =>
        prev.map((f) => (f.id === tmp.id ? { ...created } : f))
      );
      setActiveFolderId(created.id);
    } catch (e) {
      console.error(e);
      setFolders((prev) => prev.filter((f) => f.id !== tmp.id));
      alert("Could not create subfolder.");
    }
  }, []);

  // Rename folder (optimistic)
  const onRenameFolder = React.useCallback(
    async (id: string) => {
      const current = folders.find((f) => f.id === id);
      if (!current) return;
      const raw = prompt("New folder name:", current.name || "");
      const name = (raw ?? "").trim();
      if (!name || name === current.name) return;

      const prevName = current.name;
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));

      try {
        const r = await fetch(`/api/folders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!r.ok) throw new Error("Failed to rename folder");
      } catch (e) {
        console.error(e);
        // rollback
        setFolders((prev) =>
          prev.map((f) => (f.id === id ? { ...f, name: prevName } : f))
        );
        alert("Could not rename folder.");
      }
    },
    [folders]
  );

  // Delete folder (optimistic + reparent children in UI to match server)
  const onDeleteFolder = React.useCallback(
    async (id: string) => {
      const victim = folders.find((f) => f.id === id);
      if (!victim) return;

      if (
        !confirm(
          `Delete "${
            victim.name
          }"?\nDocuments move to Unfiled and subfolders will be reparented to "${
            victim.parentId ? "its parent" : "root"
          }".`
        )
      ) {
        return;
      }

      const prevFolders = folders;
      const prevDocs = docs;

      // Optimistic: remove victim, reparent direct children to victim.parentId
      setFolders((prev) =>
        prev
          .filter((f) => f.id !== id)
          .map((f) =>
            f.parentId === id ? { ...f, parentId: victim.parentId ?? null } : f
          )
      );
      // Docs in that folder → Unfiled
      setDocs((d) =>
        d.map((doc) => (doc.folderId === id ? { ...doc, folderId: null } : doc))
      );
      // If deleted folder was selected, jump to its parent (or All)
      setActiveFolderId((cur) => (cur === id ? victim.parentId ?? null : cur));

      try {
        const res = await fetch(`/api/folders/${id}`, {
          method: "DELETE",
          cache: "no-store",
        });
        if (!(res.ok || res.status === 204)) {
          const msg = await res.text().catch(() => "");
          throw new Error(`Failed to delete (${res.status}) ${msg}`);
        }
      } catch (e) {
        console.error(e);
        // rollback
        setFolders(prevFolders);
        setDocs(prevDocs);
        alert("Could not delete folder.");
      }
    },
    [folders, docs]
  );

  const handleOpen = (slug: string) => router.push(`/d/${slug}`);

  const handleRemoved = React.useCallback((slug?: string) => {
    if (!slug) return;
    setDocs((prev) => prev.filter((d) => d.slug !== slug));
  }, []);

  // Filter by mode & selected folder
  const filtered = React.useMemo(() => {
    const byMode =
      mode === "personal"
        ? docs.filter((d) => d.mode === "personal")
        : docs.filter((d) => d.mode === "shared" || d.mode === undefined);

    if (activeFolderId === null) return byMode; // All
    if (activeFolderId === "__none__") return byMode.filter((d) => !d.folderId);
    return byMode.filter((d) => d.folderId === activeFolderId);
  }, [docs, mode, activeFolderId]);

  return (
    <main className={styles.page}>
      <FolderSidebar
        folders={folders}
        activeFolderId={activeFolderId}
        onSelectFolder={setActiveFolderId}
        onCreateFolder={onCreateFolder}
        onCreateSubfolder={onCreateSubfolder} // ✅ now wired
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
      />

      <section className={styles.content}>
        <header className={styles.header}>
          <div
            className={styles.segmented}
            role="tablist"
            aria-label="Docs type"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "personal"}
              className={`${styles.segment} ${
                mode === "personal" ? styles.segmentActive : ""
              }`}
              onClick={() => setMode("personal")}
            >
              Personal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "shared"}
              className={`${styles.segment} ${
                mode === "shared" ? styles.segmentActive : ""
              }`}
              onClick={() => setMode("shared")}
            >
              Collaborative
            </button>
          </div>

          <NewDocButton mode={mode} />
        </header>

        <DocList
          docs={filtered}
          onOpen={handleOpen}
          onRemoved={handleRemoved}
        />
      </section>
    </main>
  );
}
