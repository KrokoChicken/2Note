import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const nameRaw = typeof body?.name === "string" ? body.name : "";
  const name = nameRaw.trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  // only rename if owned by user
  const { rows } = await db.execute(sql`
    UPDATE folders SET name = ${name}, updated_at = NOW()
    WHERE id = ${params.id} AND owner_user_id = ${s.user.id}
    RETURNING id, name, created_at AS "createdAt", updated_at AS "updatedAt"
  `);
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ folder: rows[0] });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const folderId = params.id;

  // 1) Load the folder and verify ownership (now includes parent_id)
  const { rows } = await db.execute(sql`
    SELECT id, owner_user_id AS "ownerUserId", parent_id AS "parentId"
    FROM folders
    WHERE id = ${folderId}
    LIMIT 1
  `);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const folder = rows[0] as {
    id: string;
    ownerUserId: string | null;
    parentId: string | null;
  };

  if (folder.ownerUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2) Transaction: move docs -> NULL, reparent children -> folder.parentId, delete folder
  try {
    // If your client exposes a typed transaction helper, prefer that.
    await db.execute(sql`BEGIN`);

    // Move docs that are currently in this folder to "Unfiled"
    await db.execute(sql`
      UPDATE documents
      SET folder_id = NULL, updated_at = NOW()
      WHERE folder_id = ${folderId} AND owner_user_id = ${userId}
    `);

    // Reparent direct children of this folder to this folder's parent
    await db.execute(sql`
      UPDATE folders
      SET parent_id = ${folder.parentId}, updated_at = NOW()
      WHERE parent_id = ${folderId} AND owner_user_id = ${userId}
    `);

    // Delete the folder itself
    await db.execute(sql`
      DELETE FROM folders
      WHERE id = ${folderId} AND owner_user_id = ${userId}
    `);

    await db.execute(sql`COMMIT`);
  } catch (e) {
    console.error("Folder delete failed:", e);
    await db.execute(sql`ROLLBACK`);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}