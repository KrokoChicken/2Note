// lib/CollabRoomContext.tsx
"use client";

import React, { createContext, useContext } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";

type Value = {
  provider: HocuspocusProvider;
  ydoc: Y.Doc;
  key: string;
};

const Ctx = createContext<Value | null>(null);

export function CollabRoomProvider({
  value,
  children,
}: {
  value: Value;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCollabRoom() {
  const v = useContext(Ctx);
  if (!v)
    throw new Error("useCollabRoom must be used inside CollabRoomProvider");
  return v;
}
