// /server/index.js
/*
import 'dotenv/config';
import { Server } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import { Database } from '@hocuspocus/extension-database';
import {
  ensureDocumentBySlug,
  fetchSnapshotBySlug,
  appendUpdate,
  storeSnapshot,
} from './hpDatabase.js';

const database = new Database({
  fetch: async ({ documentName }) => {
    const full = await fetchSnapshotBySlug(documentName);
    console.log(`[DB.fetch] ${documentName} -> ${full ? full.length : 'null'}`);
    return full ?? null;
  },
  store: async ({ documentName, document }) => {
    const docId = await ensureDocumentBySlug(documentName);
    await storeSnapshot(docId, document);
    console.log(`[DB.store] snapshot saved for ${documentName}`);
  },
});

const server = new Server({
  port: Number(process.env.HOCUSPOCUS_PORT ?? 1234),
  extensions: [new Logger(), database],

  // 🔴 append every incremental update
  onChange: async ({ documentName, update }) => {
    await appendUpdate(documentName, update);
    console.log(`[onChange] wrote ${update.length} bytes for ${documentName}`);
  },

  onConnect: ({ documentName }) => console.log(`[connect] ${documentName}`),
  onDisconnect: ({ documentName }) => console.log(`[disconnect] ${documentName}`),
});

server.listen();
console.log(`✅ Hocuspocus on ws://localhost:${process.env.HOCUSPOCUS_PORT ?? 1234}`);
*/

// /server/index.js
import 'dotenv/config';
import { Server } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import { Database } from '@hocuspocus/extension-database';
import * as Y from 'yjs';
import {
  ensureDocumentBySlug,
  fetchSnapshotBySlug,
  appendUpdate,
  storeSnapshot,
  updateTitleBySlug,       // NEW
  pruneUpdatesBeforeNow,   // NEW
} from './hpDatabase.js';

// -----------------------------
// Config
// -----------------------------
const PORT = Number(process.env.HOCUSPOCUS_PORT ?? 1234);

// Snapshot every N changes or after T ms of idleness (whichever comes first)
const SNAPSHOT_EVERY_UPDATES = 300;        // tune as you like
const SNAPSHOT_IDLE_MS = 60_000;           // 1 min idle snapshot
const MAX_UPDATE_BYTES = 512 * 1024;       // 512 KB per update guard (defensive)

// -----------------------------
// Debounced title persistence
// -----------------------------
// Keep a small per-doc in-memory debounce for title writes
const titleDebouncers = new Map(); // slug -> timeout id
const lastTitles = new Map();      // slug -> last title we persisted

function scheduleTitlePersist(slug, title, delayMs = 800) {
  const last = lastTitles.get(slug);
  if (last === title) return; // nothing new

  if (titleDebouncers.has(slug)) {
    clearTimeout(titleDebouncers.get(slug));
  }
  const id = setTimeout(async () => {
    try {
      await updateTitleBySlug(slug, title);
      lastTitles.set(slug, title);
      // console.log(`[title] persisted "${title}" for ${slug}`);
    } catch (e) {
      console.error(`[title] persist failed for ${slug}`, e);
    } finally {
      titleDebouncers.delete(slug);
    }
  }, delayMs);
  titleDebouncers.set(slug, id);
}

// -----------------------------
// Snapshot / compaction helpers
// -----------------------------
const docStats = new Map(); // slug -> { updatesSinceSnapshot, idleTimerId }

function markDocChanged(slug, ydoc) {
  const stats = docStats.get(slug) ?? { updatesSinceSnapshot: 0, idleTimerId: null };
  stats.updatesSinceSnapshot += 1;

  // idle snapshot timer
  if (stats.idleTimerId) clearTimeout(stats.idleTimerId);
  stats.idleTimerId = setTimeout(async () => {
    try {
      const id = await ensureDocumentBySlug(slug);
      await storeSnapshot(id, ydoc);
      await pruneUpdatesBeforeNow(id);
      stats.updatesSinceSnapshot = 0;
      // console.log(`[snapshot-idle] saved + pruned for ${slug}`);
    } catch (e) {
      console.error(`[snapshot-idle] failed for ${slug}`, e);
    }
  }, SNAPSHOT_IDLE_MS);

  // threshold snapshot
  if (stats.updatesSinceSnapshot >= SNAPSHOT_EVERY_UPDATES) {
    (async () => {
      try {
        const id = await ensureDocumentBySlug(slug);
        await storeSnapshot(id, ydoc);
        await pruneUpdatesBeforeNow(id);
        stats.updatesSinceSnapshot = 0;
        // console.log(`[snapshot-threshold] saved + pruned for ${slug}`);
      } catch (e) {
        console.error(`[snapshot-threshold] failed for ${slug}`, e);
      }
    })();
  }

  docStats.set(slug, stats);
}

// -----------------------------
// Database extension
// -----------------------------
const database = new Database({
  fetch: async ({ documentName }) => {
    const full = await fetchSnapshotBySlug(documentName);
    // console.log(`[DB.fetch] ${documentName} -> ${full ? full.length : 'null'}`);
    return full ?? null;
  },
  store: async ({ documentName, document }) => {
    const docId = await ensureDocumentBySlug(documentName);
    await storeSnapshot(docId, document);
    await pruneUpdatesBeforeNow(docId);
    // console.log(`[DB.store] snapshot saved for ${documentName}`);
  },
});

// -----------------------------
// Server
// -----------------------------
const server = new Server({
  port: PORT,
  extensions: [new Logger(), database],

  // Optional: auth gate – pass a token via provider `parameters` and verify.
  // onAuthenticate: async ({ connection }) => {
  //   const token = connection?.parameters?.token;
  //   if (!token || !isValid(token)) throw new Error('Unauthorized');
  //   return { userId: decode(token).sub };
  // },

  // Append every incremental update & also:
  // - persist title (debounced) from the Y.Doc's meta map (if present)
  // - schedule snapshots / compaction
  onChange: async ({ documentName, document, update }) => {
    try {
      if (update?.length > MAX_UPDATE_BYTES) {
        console.warn(`[onChange] oversize update (${update.length} bytes) for ${documentName}`);
      }
      await appendUpdate(documentName, update);

      // title persistence (if you store title in Y.Map('meta') or Y.Text('title'))
      const meta = document.getMap('meta');
      const maybeTitle = meta?.get('title');

      if (typeof maybeTitle === 'string') {
        scheduleTitlePersist(documentName, maybeTitle);
      } else {
        // Optional: if you use Y.Text('title') instead:
        // const yTitle = document.getText('title');
        // scheduleTitlePersist(documentName, yTitle.toString());
      }

      // schedule snapshot/compaction bookkeeping
      markDocChanged(documentName, document);
    } catch (e) {
      console.error(`[onChange] error for ${documentName}`, e);
    }
  },

  onConnect: ({ documentName }) => {
    console.log(`[connect] ${documentName}`);
  },
  onDisconnect: ({ documentName }) => {
    console.log(`[disconnect] ${documentName}`);
  },
});

server.listen();
console.log(`✅ Hocuspocus on ws://localhost:${PORT}`);