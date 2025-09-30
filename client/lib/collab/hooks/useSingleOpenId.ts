// Manages a single open item's id (e.g. one open menu at a time) with state.  

"use client";
import * as React from "react";
export function useSingleOpenId() {
  const [openId, setOpenId] = React.useState<string | null>(null);
  return { openId, setOpenId };
}