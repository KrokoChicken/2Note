// /app/api/docs/[slug]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

type Mode = "personal" | "shared";
type TipTapJSON = unknown;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = params.slug;
  const body = await req.json().catch(() => ({}));

  const rawTitle = typeof body?.title === "string" ? body.title : undefined;
  const content: TipTapJSON | string | undefined = body?.content;

  // folderId handling: string → move, null → unfile, undefined → no change
  const folderId: string | null | undefined =
    body?.folderId === null
      ? null
      : typeof body?.folderId === "string"
      ? body.folderId
      : undefined;

  // Load doc
  const { rows } = await db.execute(sql`
    SELECT d.id, d.owner_user_id, d.mode
    FROM documents d
    WHERE d.slug = ${slug}
    LIMIT 1
  `);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const doc = rows[0] as { id: string; owner_user_id: string | null; mode: Mode };

  const userId = session.user.id;

  // Permissions:
  // - Content/title: owner OR (shared & role in owner/editor)
  // - Folder move: owner ONLY
  let canEditContent = doc.owner_user_id === userId;
  if (!canEditContent && doc.mode === "shared") {
    const { rows: collab } = await db.execute(sql`
      SELECT 1
      FROM collaborators c
      WHERE c.document_id = ${doc.id}
        AND c.user_id = ${userId}
        AND c.role IN ('owner','editor')
      LIMIT 1
    `);
    canEditContent = collab.length > 0;
  }

  const wantsFolderChange = folderId !== undefined;
  const isOwner = doc.owner_user_id === userId;

  if (!canEditContent && !wantsFolderChange) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (wantsFolderChange && !isOwner) {
    return NextResponse.json({ error: "Only the owner can move this document" }, { status: 403 });
  }

  // Normalize title
  const title =
    rawTitle !== undefined
      ? rawTitle.trim().slice(0, 200) || "Untitled"
      : undefined;

  // Build updates
  const updates: any[] = [];

  if (title !== undefined) {
    updates.push(sql`title = ${title}`);
  }

  if (content !== undefined) {
    updates.push(sql`content = ${JSON.stringify(content)}::jsonb`);
  }

  if (wantsFolderChange) {
    if (folderId === null) {
      updates.push(sql`folder_id = NULL`);
    } else {
      if (!UUID_RE.test(folderId)) {
        return NextResponse.json({ error: "Invalid folderId" }, { status: 400 });
      }
      // Ensure folder belongs to the same owner
      const { rows: ok } = await db.execute(sql`
        SELECT 1
        FROM folders
        WHERE id = ${folderId} AND owner_user_id = ${userId}
        LIMIT 1
      `);
      if (!ok.length) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
      updates.push(sql`folder_id = ${folderId}`);
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  await db.execute(sql`
    UPDATE documents
    SET ${sql.join(updates, sql`, `)}, updated_at = NOW()
    WHERE id = ${doc.id}
  `);

  return NextResponse.json({
    ok: true,
    updated: {
      title: title !== undefined,
      content: content !== undefined,
      folderId: wantsFolderChange,
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = params.slug;
  const userId = session.user.id;

  const { rows } = await db.execute(sql`
    SELECT d.id, d.owner_user_id AS "ownerUserId", d.mode
    FROM documents d
    WHERE d.slug = ${slug}
    LIMIT 1
  `);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = rows[0] as { id: string; ownerUserId: string | null; mode: Mode };

  if (doc.ownerUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.execute(sql`
    DELETE FROM documents WHERE id = ${doc.id}
  `);

  return new NextResponse(null, { status: 204 });
}