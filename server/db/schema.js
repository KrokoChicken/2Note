import {
  pgTable,
  text,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  index,
  pgEnum
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const docMode = pgEnum("doc_mode", ["personal", "shared"]);

export const users = pgTable('users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`), // 👈 add default
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified'),  // nullable
  image: varchar('image', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    refresh_token: varchar('refresh_token', { length: 2048 }),
    access_token: varchar('access_token', { length: 2048 }),
    expires_at: integer('expires_at'),
    token_type: varchar('token_type', { length: 255 }),
    scope: varchar('scope', { length: 1024 }),
    id_token: varchar('id_token', { length: 2048 }),
    session_state: varchar('session_state', { length: 255 }),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index('accounts_by_user').on(t.userId),
  ]
);

export const sessions = pgTable('sessions', {
  sessionToken: varchar('session_token', { length: 255 }).primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull(),
    expires: timestamp('expires').notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);



export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  mode: docMode("mode").notNull().default("shared"),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdateFn(() => sql`NOW()`),
  content: jsonb("content").default(sql`'{}'::jsonb`),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
});

export const collaborators = pgTable(
  'collaborators',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id') // <-- text (matches users.id)
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull(), // 'owner' | 'editor' | 'viewer'
    alias: varchar('alias', { length: 64 }),
    firstJoinedAt: timestamp('first_joined_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.userId] }),
    index('collab_by_user').on(t.userId),
    index('collab_by_doc').on(t.documentId),
  ]
);



export const docUpdates = pgTable(
  'doc_updates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    update: jsonb('update').notNull(), // Array.from(u8)
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('updates_by_doc_time').on(t.documentId, t.createdAt)]
);


export const docSnapshots = pgTable(
  'doc_snapshots',
  {
    documentId: uuid('document_id')
      .primaryKey()
      .references(() => documents.id, { onDelete: 'cascade' }),
    stateVector: jsonb('state_vector'), // Fallback to JSONB
    snapshot: jsonb('snapshot').notNull(), // Fallback to JSONB
    updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdateFn(() => sql`NOW()`),
  },
  (t) => [index('snapshots_by_updated_at').on(t.updatedAt)]
);

// --- FOLDERS ---
export const folders = pgTable('folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(),
  parentId: uuid('parent_id').references(() => folders.id, { onDelete: 'set null' }).default(null), // 👈 add this
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdateFn(() => sql`NOW()`),
}, (t) => [
  index('folders_by_owner').on(t.ownerUserId),
  index('folders_by_owner_name').on(t.ownerUserId, t.name),
  index('folders_by_parent').on(t.parentId),
]);