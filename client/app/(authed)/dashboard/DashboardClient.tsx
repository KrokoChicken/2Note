"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NewDocButton from "./NewDocButton";
import DocList from "./DocList";
import styles from "./DashboardClient.module.css";

type Mode = "personal" | "shared";

type Doc = {
  id: string;
  slug: string;
  title: string;
  updated_at: string;
  updatedAtText: string;
  isOwner: boolean;
  mode?: Mode;
};

export default function DashboardClient({
  userName,
  docs: initial,
}: {
  userName: string;
  docs: Doc[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  // 1) Initialize from URL if present, else default to "personal"
  const urlMode =
    (params.get("mode") as Mode) === "shared" ? "shared" : "personal";
  const [mode, setMode] = useState<Mode>(urlMode);

  const [docs, setDocs] = useState<Doc[]>(initial);

  // 2) Keep URL in sync when mode changes (no navigation)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url);
  }, [mode]);

  const handleOpen = (slug: string) => router.push(`/d/${slug}`);

  const handleRemoved = useCallback((slug: string) => {
    setDocs((prev) => prev.filter((d) => d.slug !== slug));
  }, []);

  const filtered = useMemo(() => {
    if (mode === "personal") return docs.filter((d) => d.mode === "personal");
    // shared view: include legacy docs without mode
    return docs.filter((d) => d.mode === "shared" || d.mode === undefined);
  }, [docs, mode]);

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div className={styles.segmented} role="tablist" aria-label="Docs type">
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

      <DocList docs={filtered} onOpen={handleOpen} onRemoved={handleRemoved} />
    </main>
  );
}
