"use client";
import * as React from "react";
import type { Workspace } from "./useWorkspaceParam";

export type Folder = { id: string; name: string; parentId: string | null; workspace: Workspace };

const tempId = () => `temp_${Math.random().toString(36).slice(2, 10)}`;

export function useWorkspaceFolders(workspace: Workspace) {
  const [foldersByWs, setFoldersByWs] = React.useState<Record<Workspace, Folder[]>>({
    personal: [],
    shared: [],
  });

  const current = foldersByWs[workspace];

  const fetchFolders = React.useCallback(async (ws: Workspace, signal?: AbortSignal) => {
    const res = await fetch(`/api/folders?workspace=${ws}`, { cache: "no-store", signal });
    if (!res.ok) throw new Error("Failed to fetch folders");
    const data = await res.json();
    const list: Folder[] = (data.folders ?? []).map((f: any) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId ?? null,
      workspace: (f.workspace ?? ws) as Workspace,
    }));
    setFoldersByWs(prev => ({ ...prev, [ws]: list }));
  }, []);

  // load current
  React.useEffect(() => {
    if (current.length) return;
    const ac = new AbortController();
    fetchFolders(workspace, ac.signal).catch(console.error);
    return () => ac.abort();
  }, [workspace, current.length, fetchFolders]);

  // prefetch other
  React.useEffect(() => {
    const other: Workspace = workspace === "personal" ? "shared" : "personal";
    if (foldersByWs[other].length) return;
    const ac = new AbortController();
    fetchFolders(other, ac.signal).catch(() => {});
    return () => ac.abort();
  }, [workspace, foldersByWs, fetchFolders]);

  /* ---------- optimistic actions (scoped to ws) ---------- */

  const createFolder = React.useCallback(async () => {
    const raw = prompt("Folder name?");
    const name = (raw ?? "").trim();
    if (!name) return;

    const id = tempId();
    const tmp: Folder = { id, name, parentId: null, workspace };
    setFoldersByWs(prev => ({ ...prev, [workspace]: [...prev[workspace], tmp] }));

    try {
      const r = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: null, workspace }),
      });
      if (!r.ok) throw new Error("Failed to create folder");
      const { folder } = await r.json();
      setFoldersByWs(prev => ({
        ...prev,
        [workspace]: prev[workspace].map(f =>
          f.id === id ? { id: folder.id, name: folder.name, parentId: folder.parentId ?? null, workspace } : f
        ),
      }));
      return folder.id as string;
    } catch (e) {
      console.error(e);
      setFoldersByWs(prev => ({ ...prev, [workspace]: prev[workspace].filter(f => f.id !== id) }));
      alert("Could not create folder.");
      return null;
    }
  }, [workspace]);

  const createSubfolder = React.useCallback(async (parentId: string) => {
    const raw = prompt("Subfolder name?");
    const name = (raw ?? "").trim();
    if (!name) return null;

    const id = tempId();
    const tmp: Folder = { id, name, parentId, workspace };
    setFoldersByWs(prev => ({ ...prev, [workspace]: [...prev[workspace], tmp] }));

    try {
      const r = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId, workspace }),
      });
      if (!r.ok) throw new Error("Failed to create subfolder");
      const { folder } = await r.json();
      setFoldersByWs(prev => ({
        ...prev,
        [workspace]: prev[workspace].map(f =>
          f.id === id ? { id: folder.id, name: folder.name, parentId: folder.parentId ?? null, workspace } : f
        ),
      }));
      return folder.id as string;
    } catch (e) {
      console.error(e);
      setFoldersByWs(prev => ({ ...prev, [workspace]: prev[workspace].filter(f => f.id !== id) }));
      alert("Could not create subfolder.");
      return null;
    }
  }, [workspace]);

  const renameFolder = React.useCallback(async (id: string) => {
    const f = foldersByWs[workspace].find(x => x.id === id);
    if (!f) return;
    const raw = prompt("New folder name:", f.name || "");
    const name = (raw ?? "").trim();
    if (!name || name === f.name) return;

    setFoldersByWs(prev => ({
      ...prev,
      [workspace]: prev[workspace].map(x => (x.id === id ? { ...x, name } : x)),
    }));

    try {
      const r = await fetch(`/api/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error("Failed to rename folder");
    } catch (e) {
      console.error(e);
      setFoldersByWs(prev => ({
        ...prev,
        [workspace]: prev[workspace].map(x => (x.id === id ? { ...x, name: f.name } : x)),
      }));
      alert("Could not rename folder.");
    }
  }, [foldersByWs, workspace]);

  const deleteFolder = React.useCallback(async (id: string) => {
    const victim = foldersByWs[workspace].find(x => x.id === id);
    if (!victim) return false;

    if (!confirm(`Delete "${victim.name}"? Documents move to Unfiled and subfolders are reparented.`))
      return false;

    const prev = foldersByWs;
    setFoldersByWs(prev => ({
      ...prev,
      [workspace]: prev[workspace]
        .filter(x => x.id !== id)
        .map(x => (x.parentId === id ? { ...x, parentId: victim.parentId ?? null } : x)),
    }));

    try {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE", cache: "no-store" });
      if (!(res.ok || res.status === 204)) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Failed to delete (${res.status}) ${msg}`);
      }
      return true;
    } catch (e) {
      console.error(e);
      setFoldersByWs(prev);
      alert("Could not delete folder.");
      return false;
    }
  }, [foldersByWs, workspace]);

  return {
    folders: current,
    setFoldersByWs, // expose if you need advanced updates
    createFolder,
    createSubfolder,
    renameFolder,
    deleteFolder,
  };
}