"use client";
import DocListItem from "./DocListItem";
import styles from "./DocList.module.css";

type Doc = {
  id: string;
  slug: string;
  title: string;
  updatedAtText: string;
  isOwner: boolean;
};
type Workspace = "personal" | "shared";
export default function DocList({
  docs,
  onOpen,
  onRemoved,
  onMoveRequest,
  showFolderName = false,
  workspace,
}: {
  docs: Doc[];
  onOpen: (slug: string) => void;
  onRemoved: (slug: string) => void;
  onMoveRequest: (slug: string) => void;
  showFolderName?: boolean; // 👈 add this
  workspace: Workspace;
}) {
  if (docs.length === 0) {
    return <div className={styles.empty}>No documents yet. Create one!</div>;
  }

  return (
    <ul className={styles.list}>
      {docs.map((d) => (
        <DocListItem
          key={d.id}
          doc={d}
          onOpen={() => onOpen(d.slug)}
          onRemoved={() => onRemoved(d.slug)}
          onMoveRequest={() => onMoveRequest(d.slug)}
          showFolderName={showFolderName} // 👈 pass it down
          showRoleBadge={workspace === "shared"}
        />
      ))}
    </ul>
  );
}
