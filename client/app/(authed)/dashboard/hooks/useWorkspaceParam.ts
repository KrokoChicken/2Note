"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";

export type Workspace = "personal" | "shared";

export function useWorkspaceParam() {
  const params = useSearchParams();
  const initial = (params.get("ws") as Workspace) === "shared" ? "shared" : "personal";
  const [workspace, setWorkspace] = React.useState<Workspace>(initial);

  // keep URL in sync
  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("ws", workspace);
    window.history.replaceState({}, "", url);
  }, [workspace]);

  return { workspace, setWorkspace };
}