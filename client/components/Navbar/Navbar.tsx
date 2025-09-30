"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState, useMemo } from "react";
import styles from "./Navbar.module.css";

type Props = {
  user: { name?: string | null; email?: string | null; image?: string | null };
};

export default function Navbar({ user }: Props) {
  const displayName = user?.name ?? user?.email ?? "You";

  const initials = useMemo(() => {
    const base = displayName || "U";
    return (
      base
        .split(/\s+/)
        .filter(Boolean)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2) || "U"
    );
  }, [displayName]);

  // only treat as a valid src if it's a non-empty string
  const imgSrc =
    typeof user?.image === "string" && user.image.trim() ? user.image : null;
  const [imgOk, setImgOk] = useState<boolean>(Boolean(imgSrc));

  return (
    <header className={styles.shell} role="banner">
      <nav className={styles.nav} aria-label="Primary">
        <div className={styles.left}>
          <Link
            href="/dashboard"
            className={styles.brand}
            aria-label="2Note home"
          >
            <span className={styles.logoDot} />
            2Note
          </Link>

          <div className={styles.links}>
            <Link href="/dashboard" className={styles.link}>
              Dashboard
            </Link>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.userBadge} title={displayName}>
            {imgOk && imgSrc ? (
              // Show avatar image when valid
              <img
                src={imgSrc}
                alt="" // decorative; avoid hydration mismatch
                aria-hidden="true"
                className={styles.avatar}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setImgOk(false)}
              />
            ) : (
              // Fallback: initials
              <div className={styles.avatarFallback} aria-hidden="true">
                {initials}
              </div>
            )}

            <span className={styles.userName}>{displayName}</span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={styles.button}
          >
            Logout
          </button>
        </div>
      </nav>
    </header>
  );
}
