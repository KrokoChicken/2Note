import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

// Accept only these roles via API
const ALLOWED_ROLES = new Set(["viewer", "editor"] as const);
type Role = "viewer" | "editor";

type Mode = "personal" | "shared";

/** PUT: change a collaborator's role (viewer/editor) */
export async function PUT(
  req: Request,
  { params }: { params: { slug: string; userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const requesterId = session.user.id;
  const { slug, userId: targetUserId } = params;

  // Parse body.role, sanitize to lower-case
  const body = await req.json().catch(() => ({}));
  const rawRole = typeof body?.role === "string" ? body.role.toLowerCase().trim() : "";
  if (!ALLOWED_ROLES.has(rawRole as Role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const nextRole = rawRole as Role;

  // 1) Load doc (id, owner, mode)
  const { rows: docRows } = await db.execute(sql`
    SELECT d.id, d.owner_user_id, d.mode
    FROM documents d
    WHERE d.slug = ${slug}
    LIMIT 1
  `);
  if (docRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const doc = docRows[0] as { id: string; owner_user_id: string | null; mode: Mode };

  // 2) Only owners can change roles (adjust if you want editors to manage too)
  if (doc.owner_user_id !== requesterId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Target must exist & cannot be owner
  const { rows: targetRows } = await db.execute(sql`
    SELECT c.user_id, c.role
    FROM collaborators c
    WHERE c.document_id = ${doc.id} AND c.user_id = ${targetUserId}
    LIMIT 1
  `);
  if (targetRows.length === 0) {
    return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
  }
  const target = targetRows[0] as { user_id: string; role: "owner" | "editor" | "viewer" };
  if (target.role === "owner") {
    return NextResponse.json({ error: "Owner role cannot be changed" }, { status: 400 });
  }

  // Optional: disallow changing your own role here
  // if (targetUserId === requesterId) {
  //   return NextResponse.json({ error: "Cannot change your own role here" }, { status: 400 });
  // }

  if (target.role === nextRole) {
    return NextResponse.json({ ok: true, role: target.role });
  }

  // 4) Update role
  const { rows: updated } = await db.execute(sql`
    UPDATE collaborators
    SET role = ${nextRole}, last_seen_at = NOW()
    WHERE document_id = ${doc.id} AND user_id = ${targetUserId}
    RETURNING user_id, role
  `);

  return NextResponse.json({ ok: true, collaborator: updated[0] });
}

/** DELETE: remove a collaborator */
export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string; userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const requesterId = session.user.id;
  const { slug, userId: targetUserId } = params;

  // 1) Load doc
  const { rows: docRows } = await db.execute(sql`
    SELECT d.id, d.owner_user_id
    FROM documents d
    WHERE d.slug = ${slug}
    LIMIT 1
  `);
  if (docRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const doc = docRows[0] as { id: string; owner_user_id: string | null };

  // 2) Only owners can remove collaborators
  if (doc.owner_user_id !== requesterId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Target must exist & cannot be owner
  const { rows: targetRows } = await db.execute(sql`
    SELECT c.user_id, c.role
    FROM collaborators c
    WHERE c.document_id = ${doc.id} AND c.user_id = ${targetUserId}
    LIMIT 1
  `);
  if (targetRows.length === 0) {
    return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
  }
  const target = targetRows[0] as { user_id: string; role: "owner" | "editor" | "viewer" };
  if (target.role === "owner") {
    return NextResponse.json({ error: "Owner cannot be removed" }, { status: 400 });
  }

  // Optional: prevent removing yourself
  // if (targetUserId === requesterId) {
  //   return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  // }

  await db.execute(sql`
    DELETE FROM collaborators
    WHERE document_id = ${doc.id} AND user_id = ${targetUserId}
  `);

  return NextResponse.json({ ok: true });
}