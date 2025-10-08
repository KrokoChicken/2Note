// /app/(dashboard)/DashboardClient.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import styles from "./DashboardClient.module.css";

import NewDocButton from "./NewDocButton";
import DocList from "./DocList";
import FolderSidebar from "./FolderSidebar";
import MoveDocModal from "./MoveDocModal";

import { useWorkspaceParam, type Workspace } from "./hooks/useWorkspaceParam";
import { useWorkspaceFolders } from "./hooks/useWorkspaceFolders";

type Doc = {
  id: string;
  slug: string;
  title: string;
  updated_at: string;
  updatedAtText: string;
  isOwner: boolean;
  mode?: Workspace; // "personal" | "shared"
  folderId?: string | null; // null = Unfiled
};

export default function DashboardClient({
  userName,
  docs: initialDocs,
}: {
  userName: string;
  docs: Doc[];
}) {
  const router = useRouter();

  // Workspace from ?ws=personal|shared (with setter)
  const { workspace, setWorkspace } = useWorkspaceParam();

  // Local docs cache
  const [docs, setDocs] = React.useState<Doc[]>(initialDocs);

  // Folder selection (null = All, "__none__" = Unfiled)
  const [activeFolderId, setActiveFolderId] = React.useState<string | null>(
    null
  );

  // Folders for current workspace (via your hook)
  const { folders, createFolder, createSubfolder, renameFolder, deleteFolder } =
    useWorkspaceFolders(workspace);

  // Open a doc
  const handleOpen = (slug: string) => router.push(`/d/${slug}`);

  // Remove a doc from the list locally (after delete/leave)
  const handleRemoved = React.useCallback((slug?: string) => {
    if (!slug) return;
    setDocs((prev) => prev.filter((d) => d.slug !== slug));
  }, []);

  // ---- Move to folder modal wiring ----
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [movingSlug, setMovingSlug] = React.useState<string | null>(null);
  const movingDoc = React.useMemo(
    () => docs.find((d) => d.slug === movingSlug) ?? null,
    [docs, movingSlug]
  );

  const handleMoveRequest = (slug: string) => {
    setMovingSlug(slug);
    setMoveOpen(true);
  };

  const confirmMove = async (folderId: string | null) => {
    if (!movingDoc) return;
    const res = await fetch(`/api/docs/${movingDoc.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    if (!res.ok) {
      throw new Error("Failed to move document");
    }
    // optimistic local update
    setDocs((prev) =>
      prev.map((d) => (d.slug === movingDoc.slug ? { ...d, folderId } : d))
    );
  };
  // -------------------------------------

  // Filter docs by workspace + active folder
  const filtered = React.useMemo(() => {
    const byWs = docs.filter((d) =>
      workspace === "personal" ? d.mode === "personal" : d.mode === "shared"
    );
    if (activeFolderId === null) return byWs; // All
    if (activeFolderId === "__none__") return byWs.filter((d) => !d.folderId); // Unfiled
    return byWs.filter((d) => d.folderId === activeFolderId); // Specific folder
  }, [docs, workspace, activeFolderId]);

  const heading = React.useMemo(() => {
    if (activeFolderId === null) return "All documents";
    if (activeFolderId === "__none__") return "Unfiled";
    const f = folders.find((x) => x.id === activeFolderId);
    return f?.name ?? "All documents";
  }, [activeFolderId, folders]);

  return (
    <main className={styles.page}>
      <FolderSidebar
        folders={folders.map(({ id, name, parentId }) => ({
          id,
          name,
          parentId,
        }))}
        activeFolderId={activeFolderId}
        onSelectFolder={setActiveFolderId}
        onCreateFolder={async () => {
          const id = await createFolder();
          if (id) setActiveFolderId(id);
        }}
        onCreateSubfolder={async (parentId) => {
          const id = await createSubfolder(parentId);
          if (id) setActiveFolderId(id);
        }}
        onRenameFolder={renameFolder}
        onDeleteFolder={async (id) => {
          const ok = await deleteFolder(id);
          if (ok) setActiveFolderId((cur) => (cur === id ? null : cur));
        }}
        workspace={workspace}
        onSwitchWorkspace={(ws) => {
          setWorkspace(ws);
          setActiveFolderId(null); // reset selection when switching space
        }}
      />

      <section className={styles.content}>
        <header className={styles.header}>
          <h2 className={styles.h2}>{heading}</h2>
          {/* optional: show workspace as a subtle chip */}

          {/* 
  <span className={styles.subtleChip}>
    {workspace === "personal" ? "Personal" : "Collaborative"}
  </span> 
  */}

          <NewDocButton mode={workspace} />
        </header>

        <DocList
          docs={filtered}
          onOpen={handleOpen}
          onRemoved={handleRemoved}
          // ⬇️ new: let items trigger the move modal
          onMoveRequest={(slug) => handleMoveRequest(slug)}
        />
      </section>

      {/* Move-to-folder modal */}
      <MoveDocModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        docTitle={movingDoc?.title ?? ""}
        currentFolderId={movingDoc?.folderId ?? null}
        folders={folders.map(({ id, name, parentId }) => ({
          id,
          name,
          parentId,
        }))}
        onConfirm={confirmMove}
      />
    </main>
  );
}
