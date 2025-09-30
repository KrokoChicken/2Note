// /db/auth-schema.ts
import { sql } from 'drizzle-orm';
import { pgTable, text, varchar, integer, timestamp, primaryKey, index, pgEnum, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  name: varchar("name", { length: 100 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  image: varchar("image", { length: 255 }),
  emailVerified: timestamp("email_verified"), // nullable
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: varchar("refresh_token", { length: 2048 }),
    access_token: varchar("access_token", { length: 2048 }),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 1024 }),
    id_token: varchar("id_token", { length: 2048 }),
    session_state: varchar("session_state", { length: 255 }),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_by_user").on(t.userId),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 }).primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires").notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

// Optional: role enum (safer than free-form varchar)
export const collaboratorRole = pgEnum("collaborator_role", ["owner", "editor", "viewer"]);



