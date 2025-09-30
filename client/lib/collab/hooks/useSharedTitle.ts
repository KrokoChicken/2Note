// Keeps the document title in sync across collaborators via Y.Doc, updating local state instantly and saving to the server with debounce.  

"use client";
import * as React from "react";
import { patchDocTitle } from "@/lib/collab/api/docs";

export function useSharedTitle({
  ydoc, slug, initialTitle, canEdit, debounceMs = 500,
}: {
  ydoc: any; slug: string; initialTitle: string; canEdit: boolean; debounceMs?: number;
}) {
  const [title, setTitle] = React.useState(initialTitle);
  const [saving, setSaving] = React.useState<"idle" | "saving" | "saved">("idle");
  const lastLocalEditAt = React.useRef<number>(0);
  const ORIGIN = React.useMemo(() => ({ source: "title-local" }), []);
  const metaRef = React.useRef<any | null>(null);
  if (!metaRef.current && ydoc) metaRef.current = ydoc.getMap("meta");

  React.useEffect(() => {
    const meta = metaRef.current; if (!meta) return;
    if (meta.get("title") == null && initialTitle) {
      ydoc.transact(() => { meta.set("title", initialTitle); }, { source: "title-seed" });
    }
    setTitle(meta.get("title") ?? initialTitle);
    const observer = () => { if (meta.has("title")) setTitle(meta.get("title")); };
    meta.observe(observer);
    return () => meta.unobserve(observer);
  }, [ydoc, initialTitle]);

  const onChange = React.useCallback((next: string) => {
    setTitle(next);
    if (!canEdit || !metaRef.current) return;
    lastLocalEditAt.current = Date.now();
    ydoc.transact(() => { metaRef.current!.set("title", next); }, ORIGIN);
  }, [canEdit, ydoc, ORIGIN]);

  React.useEffect(() => {
    if (!canEdit) return;
    const recentlyEdited = Date.now() - lastLocalEditAt.current < 2000;
    if (!recentlyEdited) return;

    setSaving("saving");
    const t = window.setTimeout(async () => {
      try {
        await patchDocTitle(slug, (title || "").trim() || "Untitled");
        setSaving("saved");
        const done = window.setTimeout(() => setSaving("idle"), 600);
        return () => window.clearTimeout(done);
      } catch { setSaving("idle"); }
    }, debounceMs);
    return () => window.clearTimeout(t);
  }, [title, slug, canEdit, debounceMs]);

  return { title, onChange, saving };
}