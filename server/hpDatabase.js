// /server/hpDatabase.js
/*
import * as Y from 'yjs';
import { randomUUID } from 'node:crypto';
import { db } from './db/client.js';
import { documents, docUpdates, docSnapshots } from './db/schema.js';
import { eq, asc } from 'drizzle-orm';

// Uint8Array <-> JSON number[]
const toJSON = (u8) => Array.from(u8);
const fromJSON = (arr) => new Uint8Array(arr);

// Ensure a document row exists; return its id
export async function ensureDocumentBySlug(slug) {
  const existing = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.slug, slug))
    .limit(1);

  if (existing.length) return existing[0].id;

  const [created] = await db
    .insert(documents)
    .values({ id: randomUUID(), slug, title: 'Untitled' })
    .returning({ id: documents.id });

  return created.id;
}

// Fetch latest state:
// 1) Try snapshot
// 2) Else rebuild from updates and return a full update
export async function fetchSnapshotBySlug(slug) {
  const docId = await ensureDocumentBySlug(slug);

  const snapRows = await db
    .select({ snapshot: docSnapshots.snapshot })
    .from(docSnapshots)
    .where(eq(docSnapshots.documentId, docId))
    .limit(1);

  if (snapRows.length && snapRows[0].snapshot) {
    return fromJSON(snapRows[0].snapshot);
  }

  // No snapshot → rebuild from updates
  const upd = await db
    .select({ update: docUpdates.update })
    .from(docUpdates)
    .where(eq(docUpdates.documentId, docId))
    .orderBy(asc(docUpdates.createdAt));

  if (upd.length === 0) return null;

  const ydoc = new Y.Doc();
  for (const row of upd) Y.applyUpdate(ydoc, fromJSON(row.update));
  return Y.encodeStateAsUpdate(ydoc);
}

// Append one incremental Yjs update (called for every change)
export async function appendUpdate(slugOrId, updateU8) {
  const docId =
    slugOrId.length === 36 && slugOrId.includes('-')
      ? slugOrId
      : await ensureDocumentBySlug(slugOrId);

  await db.insert(docUpdates).values({
    documentId: docId,
    update: toJSON(updateU8),
  });
}

// Store (upsert) full snapshot (called on store/idle/close)
export async function storeSnapshot(docId, ydoc) {
  const snapshot = Y.encodeStateAsUpdate(ydoc);

  const updated = await db
    .update(docSnapshots)
    .set({ snapshot: toJSON(snapshot), updatedAt: new Date() })
    .where(eq(docSnapshots.documentId, docId))
    .returning({ documentId: docSnapshots.documentId });

  if (updated.length) return;

  await db.insert(docSnapshots).values({
    documentId: docId,
    snapshot: toJSON(snapshot),
  });
}
*/

// /server/hpDatabase.js
import * as Y from 'yjs';
import { randomUUID } from 'node:crypto';
import { db } from './db/client.js';
import { documents, docUpdates, docSnapshots } from './db/schema.js';
import { eq, asc, lt } from 'drizzle-orm';

// ⚠️ If possible, store binary as BYTEA (Postgres) instead of JSON int arrays.
// Keeping your helpers for now:
const toJSON = (u8) => Array.from(u8);
const fromJSON = (arr) => new Uint8Array(arr);

// Ensure a document row exists; return its id
export async function ensureDocumentBySlug(slug) {
  const existing = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.slug, slug))
    .limit(1);

  if (existing.length) return existing[0].id;

  const [created] = await db
    .insert(documents)
    .values({ id: randomUUID(), slug, title: 'Untitled' })
    .returning({ id: documents.id });

  return created.id;
}

// Fetch latest state (snapshot else rebuild)
export async function fetchSnapshotBySlug(slug) {
  const docId = await ensureDocumentBySlug(slug);

  const snapRows = await db
    .select({ snapshot: docSnapshots.snapshot })
    .from(docSnapshots)
    .where(eq(docSnapshots.documentId, docId))
    .limit(1);

  if (snapRows.length && snapRows[0].snapshot) {
    return fromJSON(snapRows[0].snapshot);
  }

  const upd = await db
    .select({ update: docUpdates.update })
    .from(docUpdates)
    .where(eq(docUpdates.documentId, docId))
    .orderBy(asc(docUpdates.createdAt));

  if (upd.length === 0) return null;

  const ydoc = new Y.Doc();
  for (const row of upd) Y.applyUpdate(ydoc, fromJSON(row.update));
  return Y.encodeStateAsUpdate(ydoc);
}

// Append one incremental Yjs update (called on every change)
export async function appendUpdate(slugOrId, updateU8) {
  const docId =
    slugOrId.length === 36 && slugOrId.includes('-')
      ? slugOrId
      : await ensureDocumentBySlug(slugOrId);

  await db.insert(docUpdates).values({
    documentId: docId,
    update: toJSON(updateU8),
  });
}

// Store (upsert) full snapshot
export async function storeSnapshot(docId, ydoc) {
  const snapshot = Y.encodeStateAsUpdate(ydoc);

  const updated = await db
    .update(docSnapshots)
    .set({ snapshot: toJSON(snapshot), updatedAt: new Date() })
    .where(eq(docSnapshots.documentId, docId))
    .returning({ documentId: docSnapshots.documentId });

  if (updated.length) return;

  await db.insert(docSnapshots).values({
    documentId: docId,
    snapshot: toJSON(snapshot),
  });
}

// NEW: prune all updates older than the current moment (post-snapshot)
export async function pruneUpdatesBeforeNow(docId) {
  // If you track a watermark, you could prune only <= snapshot.updatedAt.
  // For simplicity, remove *all* updates after saving a fresh snapshot:
  await db.delete(docUpdates).where(eq(docUpdates.documentId, docId));
}

// NEW: update title in documents table (called by debouncer)
export async function updateTitleBySlug(slug, title) {
  await db
    .update(documents)
    .set({ title, updatedAt: new Date() })
    .where(eq(documents.slug, slug));
}