export async function fetchMyRole(slug: string) {
  const res = await fetch(`/api/docs/${encodeURIComponent(slug)}/my-role`, {
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 404) return "none" as const;
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const role = data?.role as "owner" | "editor" | "viewer" | undefined;
  return role ?? null;
}

export async function patchDocTitle(slug: string, title: string) {
  const res = await fetch(`/api/docs/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to save title");
}

export async function promoteNote(slug: string) {
  const res = await fetch(`/api/docs/${encodeURIComponent(slug)}/promote`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Promote failed");
  }
}