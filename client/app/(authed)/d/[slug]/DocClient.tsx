"use client";

import * as React from "react";
import Link from "next/link";

import ModeAwareEditor from "@/components/CollabEditor/CollabEditor";
import ShareBox from "./ShareBox";
import CollaboratorsPanel from "@/components/CollabPanel/CollabPanel";
import { CollabRoomProvider } from "@/lib/collab/CollabRoomContext";
import styles from "./DocClient.module.css";

import { useCollabRoomLifecycle } from "@/lib/collab/hooks/useCollabRoomLifecycle";
import { useMyRoleRealtime } from "@/lib/collab/hooks/useMyRoleRealtime";
import { useSharedTitle } from "@/lib/collab/hooks/useSharedTitle";
import { useKickOnRemoval } from "@/lib/collab/hooks/useKickOnRemoval";

type Mode = "personal" | "shared";
type Collaborator = {
  id: string;
  name: string;
  image: string | null;
  role: "owner" | "editor" | "viewer";
};

type Props = {
  slug: string;
  title: string;
  isOwner: boolean;
  userName: string;
  wsUrl: string;
  mode?: Mode;
  currentUserId: string;
  collaborators?: Collaborator[];
  initialContent?: unknown;
};

export default function DocClient({
  slug,
  title,
  isOwner,
  userName,
  wsUrl,
  mode,
  currentUserId,
  collaborators = [],
  initialContent,
}: Props) {
  const effectiveMode: Mode = mode ?? "shared";

  // Provider + ydoc lifecycle
  const room = useCollabRoomLifecycle({ slug, wsUrl, currentUserId, userName });

  // Role & permissions
  const initialRole =
    collaborators.find((c) => c.id === currentUserId)?.role ??
    (isOwner ? "owner" : "viewer");

  const { role, canEdit } = useMyRoleRealtime({
    slug,
    provider: room.provider,
    initialRole,
  });

  const kicked = useKickOnRemoval({ slug, provider: room.provider, role });
  const wasKicked = kicked || role === "none";

  // Shared title (+ debounced persistence)
  const {
    title: sharedTitle,
    onChange: setSharedTitle,
    saving,
  } = useSharedTitle({
    ydoc: room.ydoc,
    slug,
    initialTitle: title,
    canEdit,
    debounceMs: 500,
  });

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (title.trim().toLowerCase().startsWith("untitled")) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [title]);

  const contentRowClass = `${styles.contentRow} ${
    effectiveMode !== "shared" ? styles.noSidebar : ""
  }`;
  console.log("[DocClient] initialContent prop:", initialContent);
  return (
    <CollabRoomProvider value={room}>
      <main className={styles.container}>
        {wasKicked && (
          <div role="status" aria-live="polite" className={styles.kickedBanner}>
            You were removed from this document. Redirecting…
          </div>
        )}

        <header className={styles.header}>
          <div className={styles.left}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Dashboard
            </Link>

            <input
              ref={inputRef}
              className={styles.titleInput}
              value={sharedTitle}
              onChange={(e) => setSharedTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              aria-label="Document title"
              disabled={!canEdit || wasKicked}
            />

            <span className={styles.saveBadge}>
              {saving === "saving"
                ? "Saving…"
                : saving === "saved"
                ? "Saved"
                : ""}
            </span>
          </div>

          <div className={styles.right}>
            {isOwner &&
              !wasKicked &&
              (effectiveMode === "shared" ? (
                <ShareBox slug={slug} />
              ) : (
                <PromoteToSharedButton slug={slug} />
              ))}
          </div>
        </header>

        <div className={contentRowClass}>
          <div className={styles.editorCol}>
            <div className={styles.editorWrap}>
              <ModeAwareEditor
                key={`${slug}:${effectiveMode}`} // <- helps avoid stale editor instances
                mode={effectiveMode}
                docSlug={slug}
                userId={currentUserId}
                user={{ name: userName, color: "#4f46e5" }}
                wsUrl={wsUrl}
                provider={room.provider}
                ydoc={room.ydoc}
                canEdit={!wasKicked && canEdit}
                initialContent={initialContent} // <- PASS IT!
              />
            </div>
          </div>

          {effectiveMode === "shared" && !wasKicked && (
            <aside className={styles.sidebar}>
              <CollaboratorsPanel
                docSlug={slug}
                initial={collaborators}
                isOwner={isOwner}
                currentUserId={currentUserId}
              />
            </aside>
          )}
        </div>
      </main>
    </CollabRoomProvider>
  );
}

/* Keep inline (or move) */
function PromoteToSharedButton({ slug }: { slug: string }) {
  const [busy, setBusy] = React.useState(false);
  const onClick = React.useCallback(async () => {
    if (!confirm("Make this note collaborative so you can invite others?"))
      return;
    setBusy(true);
    try {
      const { promoteNote } = await import("@/lib/collab/api/docs");
      await promoteNote(slug);
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Could not promote note.");
    } finally {
      setBusy(false);
    }
  }, [slug]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={styles.shareBtn}
    >
      {busy ? "Promoting…" : "Share (make collaborative)"}
    </button>
  );
}
