"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "personal" | "shared";

export default function NewDocButton({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }), // 👈 send mode
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      router.push(`/d/${data.slug}`);
    } catch (e) {
      console.error(e);
      alert("Could not create doc.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{ padding: "8px 14px" }}
    >
      {loading
        ? "Creating..."
        : mode === "personal"
        ? "New Personal Doc"
        : "New Collaborative Doc"}
    </button>
  );
}
