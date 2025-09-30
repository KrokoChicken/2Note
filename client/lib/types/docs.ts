export type DocMode = "personal" | "shared";
export type CollaboratorRole = "owner" | "editor" | "viewer";

export type DocumentRow = {
  id: string;
  slug: string;
  title: string;
  
  ownerUserId: string | null; // matches owner_user_id
  createdAt: string;          // or Date if you parse dates
  updatedAt: string;
  mode: DocMode;
  content: unknown | string | null;  // 👈 allow JSONB object OR string
};

export type CollaboratorRow = {
  documentId: string;
  userId: string;
  role: CollaboratorRole;
  alias: string | null;
  firstJoinedAt: string;
  lastSeenAt: string;
};