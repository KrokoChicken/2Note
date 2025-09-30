"use client";

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import type * as Y from "yjs";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import styles from "./CollabEditor.module.css";
import { acquireProvider, releaseProvider } from "@/lib/collab/registry";
import Toolbar from "./Toolbar";

type Mode = "personal" | "shared";

export type EditorProps = {
  mode: Mode;
  docSlug: string;
  user: { name: string; color?: string };
  userId: string;
  wsUrl?: string; // only for shared (acquire)
  provider?: HocuspocusProvider; // optional injected
  ydoc?: Y.Doc; // optional injected
  canEdit?: boolean;
  /** TipTap JSON or HTML string preloaded server-side for personal mode */
  initialContent?: unknown;
};

// tiny debounce
function debounce<F extends (...args: any[]) => void>(fn: F, ms: number) {
  let t: number | undefined;
  return (...args: Parameters<F>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

export default function ModeAwareEditor({
  mode,
  docSlug,
  user,
  userId,
  wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:1234",
  provider: injectedProvider,
  ydoc: injectedYdoc,
  canEdit = true,
  initialContent,
}: EditorProps) {
  const isShared = mode === "shared";
  const usingInjected = Boolean(injectedProvider && injectedYdoc);

  // ---- Resolve Y.Doc + provider (prefer injected) ----
  const room = React.useMemo(() => {
    if (!isShared) {
      // personal mode: in-memory doc, no provider
      const Yjs = require("yjs") as typeof import("yjs");
      return {
        ydoc: new Yjs.Doc() as Y.Doc,
        provider: null as unknown as HocuspocusProvider,
        key: `local:${docSlug}`,
        acquired: false,
      };
    }

    if (usingInjected) {
      return {
        ydoc: injectedYdoc as Y.Doc,
        provider: injectedProvider as HocuspocusProvider,
        key: "__external__",
        acquired: false,
      };
    }

    // shared mode, no injection: acquire from registry
    const { ydoc, provider, key } = acquireProvider(docSlug, wsUrl);
    return { ydoc, provider, key, acquired: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShared, usingInjected, injectedProvider, injectedYdoc, docSlug, wsUrl]);

  // ---- Release only if we acquired internally ----
  React.useEffect(() => {
    if (!room.acquired) return;
    return () => {
      try {
        releaseProvider(room.key as unknown as string);
      } catch {}
    };
  }, [room.acquired, room.key]);

  // ---- Connection/sync status (shared only) ----
  const [status, setStatus] = React.useState<
    "connecting" | "connected" | "disconnected"
  >(() => (isShared ? "connecting" : "connected"));
  const [synced, setSynced] = React.useState(false);

  React.useEffect(() => {
    if (!isShared) return;
    const provider = room.provider;

    const onStatus = ({
      status,
    }: {
      status: "connecting" | "connected" | "disconnected";
    }) => {
      setStatus(status);
      if (status !== "connected") setSynced(false);
    };

    const onSynced = (isSynced: boolean) => {
      setSynced(isSynced);
      if (isSynced) setStatus("connected");
    };

    provider?.on?.("status", onStatus);
    provider?.on?.("synced", onSynced);

    return () => {
      // ensure cleanup returns void
      provider?.off?.("status", onStatus);
      provider?.off?.("synced", onSynced);
    };
  }, [isShared, room.provider]);

  // ---- Extensions ----
  const cursorUser = React.useMemo(
    () => ({
      id: String(userId),
      name: user.name,
      color: user.color ?? "#4f46e5",
    }),
    [userId, user.name, user.color]
  );

  const extensions = React.useMemo(() => {
    if (isShared) {
      return [
        Collaboration.configure({ document: room.ydoc }),
        CollaborationCursor.configure({
          provider: room.provider,
          user: cursorUser,
        }),
        StarterKit.configure({ history: false }),
      ];
    }
    return [StarterKit]; // personal includes history
  }, [isShared, room.ydoc, room.provider, cursorUser]);

  // ---- TipTap Editor ----
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    editorProps: {
      attributes: {
        class: styles.editor,
        "data-readonly": (!canEdit).toString(),
      },
    },
    editable: canEdit,
  });

  // Reflect canEdit changes live
  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(!!canEdit);
    if (!canEdit) {
      try {
        editor.commands.blur();
        const { state, view } = editor as any;
        if (state?.tr) {
          const tr = state.tr.setSelection(
            state.selection.empty && state.selection
          );
          view?.dispatch?.(tr);
        }
      } catch {}
    }
    const dom = editor.view?.dom as HTMLElement | undefined;
    if (dom) dom.setAttribute("data-readonly", (!canEdit).toString());
  }, [editor, canEdit]);

  React.useEffect(() => {
    return () => {
      try {
        if (editor) editor.destroy();
      } catch {}
    };
  }, [editor]);

  // ---------- PERSONAL MODE: hydrate & save ----------
  // gate saves until hydrate finishes
  const [initialLoaded, setInitialLoaded] = React.useState(!isShared);

  // Hydrate from server-provided content (no extra fetch), parse JSON-looking strings
  React.useEffect(() => {
    if (isShared || !editor) return;
    try {
      console.log("[hydrate] initialContent (raw):", initialContent);

      let payload = initialContent ?? null;

      if (typeof payload === "string") {
        const s = payload.trim();
        if (s.startsWith("{") || s.startsWith("[")) {
          try {
            payload = JSON.parse(s);
            console.log("[hydrate] parsed JSON:", payload);
          } catch {
            console.log("[hydrate] JSON parse failed; treating as HTML string");
          }
        }
      }

      if (payload != null) {
        if (typeof payload === "string") {
          editor.commands.setContent(payload, { emitUpdate: false }); // HTML
        } else {
          editor.commands.setContent(payload as any, { emitUpdate: false }); // TipTap JSON
        }
      }
    } finally {
      setInitialLoaded(true);
    }
  }, [isShared, editor, initialContent]);

  // Debounced save (personal only) — ✅ gated by initialLoaded to prevent empty overwrite
  React.useEffect(() => {
    if (isShared || !editor || !canEdit || !initialLoaded) return;

    const save = debounce(async () => {
      try {
        const json = editor.getJSON();
        const preview = JSON.stringify(json).slice(0, 200);
        console.log("[save] outgoing JSON preview:", preview);

        const res = await fetch(`/api/docs/${encodeURIComponent(docSlug)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
          body: JSON.stringify({ content: json }),
        });

        const payload = await res.json().catch(() => ({} as any));
        console.log("[save] server response:", payload);

        if (!res.ok) {
          console.error("PATCH failed", res.status, payload);
        }
      } catch (e) {
        console.error("Save failed", e);
      }
    }, 600);

    editor.on("update", save);
    return () => {
      if (editor) editor.off("update", save);
    };
  }, [isShared, editor, docSlug, canEdit, initialLoaded]);

  // Loading gate
  if (!editor || (!isShared && !initialLoaded)) {
    return (
      <div className={styles.container}>
        <div className={styles.document}>Loading editor…</div>
      </div>
    );
  }

  // (Optional) status badge logic if you display it somewhere
  const badgeClass = !isShared
    ? styles.badgeOk
    : synced || status === "connected"
    ? styles.badgeOk
    : status === "connecting"
    ? styles.badgeWarn
    : styles.badgeErr;

  return (
    <div className={styles.container}>
      <div className={styles.document}>
        <div className={styles.toolbarBar}>
          {canEdit ? (
            <Toolbar editor={editor} />
          ) : (
            <div className={styles.readonlyBar} aria-live="polite">
              View only
            </div>
          )}
        </div>
        <div className={styles.editorArea} aria-readonly={!canEdit}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
