import type { Collaborator, Role } from "../types";

export async function fetchCollaborators(docSlug: string): Promise<Collaborator[] | null> {
  try {
    const res = await fetch(`/api/docs/${encodeURIComponent(docSlug)}/collaborators`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.collaborators) ? (data.collaborators as Collaborator[]) : null;
  } catch { return null; }
}

export async function updateRole(docSlug: string, userId: string, role: Exclude<Role, "owner">) {
  const res = await fetch(`/api/docs/${encodeURIComponent(docSlug)}/collaborators/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to update role");
}

export async function removeCollaborator(docSlug: string, userId: string) {
  const res = await fetch(`/api/docs/${encodeURIComponent(docSlug)}/collaborators/${encodeURIComponent(userId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to remove collaborator");
}