import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

type Workspace = "personal" | "shared";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ---------- GET /api/folders?workspace=personal|shared ---------- */
export async function GET(req: Request) {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const wsParam = url.searchParams.get("workspace");
  const workspace: Workspace | null =
    wsParam === "personal" || wsParam === "shared" ? wsParam : null;

  const { rows } = await db.execute(sql`
    SELECT
      id,
      name,
      parent_id   AS "parentId",
      workspace   AS "workspace",
      created_at  AS "createdAt",
      updated_at  AS "updatedAt"
    FROM folders
    WHERE owner_user_id = ${s.user.id}
      ${workspace ? sql`AND workspace = ${workspace}` : sql``}
    ORDER BY name ASC
  `);

  return NextResponse.json({ folders: rows });
}

/* --------------------------- POST /api/folders ---------------------------
   body: { name: string, workspace: "personal" | "shared", parentId?: uuid }
--------------------------------------------------------------------------- */
export async function POST(req: Request) {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));

  // name
  const rawName: unknown = body?.name;
  const name =
    typeof rawName === "string" ? rawName.trim().slice(0, 80) : "";
  if (!name) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  // workspace (REQUIRED)
  const ws: unknown = body?.workspace;
  const workspace: Workspace =
    ws === "shared" ? "shared" : ws === "personal" ? "personal" : null!;
  if (!workspace) {
    return NextResponse.json(
      { error: "Missing or invalid workspace" },
      { status: 400 }
    );
  }

  // optional parentId (must exist, belong to user, and have same workspace)
  let parentId: string | null = null;
  if (typeof body?.parentId === "string" && body.parentId) {
    if (!UUID_RE.test(body.parentId)) {
      return NextResponse.json({ error: "Invalid parentId" }, { status: 400 });
    }

    const { rows: parentRows } = await db.execute(sql`
      SELECT id, workspace
      FROM folders
      WHERE id = ${body.parentId} AND owner_user_id = ${s.user.id}
      LIMIT 1
    `);
    if (parentRows.length === 0) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }
    const parent = parentRows[0] as { id: string; workspace: Workspace };

    if (parent.workspace !== workspace) {
      return NextResponse.json(
        { error: "Parent folder is in a different workspace" },
        { status: 400 }
      );
    }

    parentId = parent.id;
  }

  // create
  const { rows } = await db.execute(sql`
    INSERT INTO folders (owner_user_id, name, parent_id, workspace)
    VALUES (${s.user.id}, ${name}, ${parentId}, ${workspace})
    RETURNING
      id,
      name,
      parent_id   AS "parentId",
      workspace   AS "workspace",
      created_at  AS "createdAt",
      updated_at  AS "updatedAt"
  `);

  return NextResponse.json({ folder: rows[0] }, { status: 201 });
}