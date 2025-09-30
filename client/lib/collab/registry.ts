// lib/collabRegistry.ts
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";

export type LocalUser = { id: string; name: string; color?: string };

export type RoomEntry = {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  refs: number;
  disposeTimer?: ReturnType<typeof setTimeout>;
  localUser?: LocalUser;
  key: string; // normalized identity for debugging
};

const rooms = new Map<string, RoomEntry>();

const DISPOSE_DELAY_MS = 15000;

function normalizeWsUrl(raw: string) {
  try {
    const u = new URL(raw);
    // normalize: strip trailing slash and volatile query/hash so identity is stable
    u.search = "";
    u.hash = "";
    u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function roomKey(wsUrl: string, slug: string) {
  return `${normalizeWsUrl(wsUrl)}::${slug}`;
}

type ProviderStatus = "connecting" | "connected" | "disconnected";

export function acquireProvider(slug: string, wsUrl: string) {
  const key = roomKey(wsUrl, slug);
  let entry = rooms.get(key);

  if (!entry) {
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: normalizeWsUrl(wsUrl),
      name: slug,
      document: ydoc,
    });

    entry = { ydoc, provider, refs: 0, key };
    rooms.set(key, entry);

    // Re-assert presence on (re)connect so awareness survives reconnects.
    const onStatus = ({ status }: { status: ProviderStatus }) => {
      if (status === "connected" && entry?.localUser) {
        (provider as any).awareness?.setLocalStateField("user", entry.localUser);
      }
    };
    provider.on("status", onStatus);
  }

  entry.refs += 1;

  // Cancel pending dispose if we re-acquired quickly
  if (entry.disposeTimer) {
    clearTimeout(entry.disposeTimer);
    entry.disposeTimer = undefined;
  }

  // If we already know the user, reassert now to avoid any "offline" flash
  if (entry.localUser) {
    (entry.provider as any).awareness?.setLocalStateField("user", entry.localUser);
  }

  return { provider: entry.provider, ydoc: entry.ydoc, key: entry.key };
}

/** Seed or update the local user presence for this room (and remember it for reconnects). */
export function setLocalUser(slug: string, wsUrl: string, user: LocalUser) {
  const key = roomKey(wsUrl, slug);
  const entry = rooms.get(key);
  if (!entry) return;
  entry.localUser = user;
  (entry.provider as any).awareness?.setLocalStateField("user", user);
}

/** Release a reference to the room. Actual destroy happens after a grace delay if no refs remain. */
export function releaseProvider(key: string) {
  const entry = rooms.get(key);
  if (!entry) return;

  entry.refs -= 1;

  if (entry.refs <= 0 && !entry.disposeTimer) {
    entry.disposeTimer = setTimeout(() => {
      try {
        (entry.provider as any).awareness?.setLocalState(null);
      } catch {}
      try {
        entry.provider.destroy();
      } catch {}
      try {
        entry.ydoc.destroy();
      } catch {}
      rooms.delete(key);
    }, DISPOSE_DELAY_MS);
  }
}