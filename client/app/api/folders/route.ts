import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function GET() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await db.execute(sql`
    SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM folders WHERE owner_user_id = ${s.user.id}
    ORDER BY name ASC
  `);
  return NextResponse.json({ folders: rows });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const nameRaw = typeof body?.name === "string" ? body.name : "";
  const name = nameRaw.trim().slice(0, 80);
  if (!name) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  // optional parentId
  let parentId: string | null = null;
  if (typeof body?.parentId === "string" && body.parentId) {
    if (!UUID_RE.test(body.parentId)) {
      return NextResponse.json({ error: "Invalid parentId" }, { status: 400 });
    }
    // ensure parent exists and belongs to this user
    const { rows: p } = await db.execute(sql`
      SELECT id FROM folders
      WHERE id = ${body.parentId} AND owner_user_id = ${s.user.id}
      LIMIT 1
    `);
    if (p.length === 0) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }
    parentId = body.parentId;
  }

  const { rows } = await db.execute(sql`
    INSERT INTO folders (owner_user_id, name, parent_id)
    VALUES (${s.user.id}, ${name}, ${parentId})
    RETURNING
      id,
      name,
      parent_id AS "parentId",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `);

  return NextResponse.json({ folder: rows[0] }, { status: 201 });
}