"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import styles from "./ShareBox.module.css";
import { useCollabRoom } from "@/lib/collab/CollabRoomContext";

type MsgKind = "success" | "error" | null;

// helper (top of file, outside component)
function uniqueBumpToken() {
  // always a new, lexicographically sortable token
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ShareBox({ slug }: { slug: string }) {
  const { provider } = useCollabRoom();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<MsgKind>(null);

  // keep a handle on the success auto-dismiss timer
  const clearTimer = useRef<number | null>(null);

  // clear any pending timer on unmount
  useEffect(() => {
    return () => {
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
    };
  }, []);

  const onShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // cancel any pending success clear
    if (clearTimer.current) {
      window.clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }

    setBusy(true);
    setMsg(null); // container stays rendered → no layout jump
    setMsgKind(null);

    try {
      const res = await fetch(`/api/docs/${encodeURIComponent(slug)}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to share");
      }

      // Success
      setMsg("Access granted.");
      setMsgKind("success");
      setEmail("");

      // bump awareness → others refresh collaborators
      (provider as any)?.awareness?.setLocalStateField(
        "rolesBump",
        uniqueBumpToken()
      );

      // auto-dismiss success after 3s
      clearTimer.current = window.setTimeout(() => {
        setMsg(null);
        setMsgKind(null);
        clearTimer.current = null;
      }, 3000);
    } catch (err: any) {
      // Error persists until user edits input or retries
      setMsg(err?.message || "Could not share");
      setMsgKind("error");
    } finally {
      setBusy(false);
    }
  };

  // If the user edits the email and the current message is an error, hide it
  const onEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (msgKind === "error") {
      setMsg(null);
      setMsgKind(null);
    }
  };

  return (
    <form className={styles.box} onSubmit={onShare}>
      <div className={styles.row}>
        <input
          type="email"
          placeholder="Invite by email"
          value={email}
          onChange={onEmailChange}
          required
          className={styles.input}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
          className={styles.select}
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button className={styles.button} disabled={busy} aria-busy={busy}>
          {busy ? "Sharing…" : "Share"}
        </button>
      </div>

      {/* Always render; toggle text visibility to avoid height changes */}
      <div
        className={styles.msgContainer}
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          className={`${styles.msg} ${
            msgKind === "success" ? styles.msgSuccess : ""
          } ${msgKind === "error" ? styles.msgError : ""}`}
          style={{ visibility: msg ? "visible" : "hidden" }}
        >
          {msg || "placeholder"}
        </span>
      </div>
    </form>
  );
}
