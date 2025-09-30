
// /app/api/docs/[slug]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

type Mode = "personal" | "shared";
// TipTap JSON: we don't enforce shape here; store as JSONB
type TipTapJSON = unknown;

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

  // Permissions: owner OR (shared & editor/owner)
  const userId = session.user.id;
  let canEdit = doc.owner_user_id === userId;
  if (!canEdit && doc.mode === "shared") {
    const { rows: collab } = await db.execute(sql`
      SELECT 1
      FROM collaborators c
      WHERE c.document_id = ${doc.id}
        AND c.user_id = ${userId}
        AND c.role IN ('owner','editor')
      LIMIT 1
    `);
    canEdit = collab.length > 0;
  }
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Normalize fields
  const title =
    rawTitle !== undefined
      ? rawTitle.trim().slice(0, 200) || "Untitled"
      : undefined;

  // Build dynamic update using Drizzle fragments
  const updates: any[] = [];
  if (title !== undefined) {
    updates.push(sql`title = ${title}`);
  }
  if (content !== undefined) {
    // Store as JSONB (stringify regardless of object/string input)
    updates.push(sql`content = ${JSON.stringify(content)}::jsonb`);
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
      title: title !== undefined ? true : false,
      content: content !== undefined ? true : false,
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

  // Find the doc (get id + owner)
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

  // Only owner can delete the document
  if (doc.ownerUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // FKs (collaborators, updates, snapshots) should cascade
  await db.execute(sql`
    DELETE FROM documents WHERE id = ${doc.id}
  `);

  // 204 is clean for deletes; 200 also fine
  return new NextResponse(null, { status: 204 });
}