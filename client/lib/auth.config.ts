// /lib/auth.config.ts
import { type NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import { users, accounts, sessions, verificationTokens } from "@/db/auth-schema";

const isDev = process.env.NODE_ENV !== "production";

export const authOptions: NextAuthOptions = {
  // Good to set explicitly
  secret: process.env.NEXTAUTH_SECRET,
  

  // Make sure the adapter uses your snake_case tables
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

  // Always send people to your custom login page
  pages: {
    signIn: "/login",
  },

  // Ask Google nicely for refresh tokens in dev
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      // Optional but handy:
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // Ensure the JWT keeps a stable id from DB on first sign-in
    async jwt({ token, user }) {
      // user is defined only on first sign-in
      if (user?.id) {
        token.sub = user.id; // NextAuth also uses sub, but set it explicitly
      }
      return token;
    },
    // Expose user.id to the session object used on the server/client
    async session({ session, token }) {
      if (token?.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    // Optional: always land on /dashboard after auth
    async redirect({ url, baseUrl }) {
      // Allow relative and same-origin URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      // Fallback to dashboard
      return `${baseUrl}/dashboard`;
    },
  },

  debug: isDev,
};