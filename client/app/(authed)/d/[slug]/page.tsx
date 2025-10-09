// /app/(authed)/d/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import DocClient from "./DocClient";
import type { DocumentRow, CollaboratorRole } from "@/lib/types/docs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 👇 params is a Promise now
type Props = { params: Promise<{ slug: string }> };

export default async function DocPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) notFound();
  const userId = session.user.id;

  const { slug } = await params; // 👈 await it

  // Fetch doc (explicit aliases + debug db name)
  const { rows } = await db.execute(sql`
    SELECT
      d.id,
      d.slug,
      d.title,
      d.content                    AS "content",
      d.owner_user_id              AS "ownerUserId",
      d.mode                       AS "mode",
      d.created_at                 AS "createdAt",
      d.updated_at                 AS "updatedAt",
      current_database()           AS "dbName"
    FROM documents d
    WHERE d.slug = ${slug}
    LIMIT 1
  `);
  if (rows.length === 0) notFound();

  const row = rows[0] as DocumentRow & { dbName?: string };
  const mode = (row.mode ?? "shared") as "personal" | "shared";
  const isOwner = row.ownerUserId === userId;

  // Access control
  if (mode === "shared") {
    const { rows: access } = await db.execute(sql`
      SELECT 1
      FROM collaborators c
      WHERE c.document_id = ${row.id} AND c.user_id = ${userId}
      LIMIT 1
    `);
    if (!isOwner && access.length === 0) notFound();
  } else {
    if (!isOwner) notFound();
  }

  // Normalize content for client serialization
  let initialContent: unknown | null = row.content ?? null;
  try {
    initialContent = JSON.parse(JSON.stringify(initialContent));
  } catch {
    initialContent = null;
  }
  if (typeof initialContent === "string") {
    const s = initialContent.trim();
    if (s.startsWith("{") || s.startsWith("[")) {
      try {
        initialContent = JSON.parse(s);
      } catch {}
    }
  }

  // Collaborators (shared only)
  let collaborators:
    | Array<{
        id: string;
        name: string;
        image: string | null;
        role: CollaboratorRole;
      }>
    | undefined;

  if (mode === "shared") {
    const { rows: collabs } = await db.execute(sql`
      SELECT
        c.user_id  AS "userId",
        c.role     AS "role",
        u.name     AS "name",
        u.image    AS "image"
      FROM collaborators c
      JOIN users u ON u.id = c.user_id
      WHERE c.document_id = ${row.id}
      ORDER BY (c.role = 'owner') DESC, u.name ASC
    `);

    collaborators = (
      collabs as Array<{
        userId: string;
        role: CollaboratorRole;
        name: string | null;
        image: string | null;
      }>
    ).map((r) => ({
      id: r.userId,
      name: r.name ?? "Unknown",
      image: r.image ?? null,
      role: r.role,
    }));
  }

  return (
    <DocClient
      slug={row.slug}
      title={row.title}
      isOwner={isOwner}
      userName={session.user.name ?? "You"}
      wsUrl={process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234"}
      mode={mode}
      currentUserId={userId}
      collaborators={collaborators ?? []}
      initialContent={initialContent}
    />
  );
}
