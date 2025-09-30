"use client";
import * as React from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const [loading, setLoading] = React.useState(false);
  const params = useSearchParams();
  const error = params.get("error"); // show auth errors if any

  async function handleGoogle() {
    try {
      setLoading(true);
      await signIn("google", { callbackUrl: "/dashboard", redirect: true });
    } catch {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        {/* Optional logo/title area */}
        <div className={styles.brand}>
          {/* Tiny logo circle */}
          <span className={styles.logoDot} aria-hidden="true" />
          <span className={styles.brandName}>2Note</span>
        </div>

        <h1 className={styles.title}>Sign in</h1>

        {error && (
          <div className={styles.alert} role="alert">
            Couldn’t sign you in. Please try again.
          </div>
        )}

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogle}
          disabled={loading}
          aria-busy={loading ? "true" : "false"}
        >
          <span className={styles.googleIcon} aria-hidden="true">
            {/* Google "G" mark (SVG) */}
            <svg viewBox="0 0 48 48" width="18" height="18">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3A12.9 12.9 0 0 1 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.5 4 9.9 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.3 0 10.2-2 13.8-5.3l-6.4-5.2A12.8 12.8 0 0 1 24 36c-5.2 0-9.7-3.3-11.3-7.9l-6.6 5.1C9.6 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.5l6.4 5.2C40.9 35.7 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z"
              />
            </svg>
          </span>
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Signing in...
            </>
          ) : (
            <>Continue with Google</>
          )}
        </button>

        <div className={styles.divider} role="separator" aria-label="divider">
          <span className={styles.line} />
          <span className={styles.or}>or</span>
          <span className={styles.line} />
        </div>

        {/* Placeholders if you add more methods later */}
        <p className={styles.hint}>More sign-in options coming soon.</p>

        <p className={styles.terms}>
          By continuing, you agree to our <a href="/terms">Terms</a> and{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
