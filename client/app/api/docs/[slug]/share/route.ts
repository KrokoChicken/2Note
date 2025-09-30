import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

// POST /api/docs/:slug/share
// body: { email: string, role?: 'editor' | 'viewer' }
export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, role } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }
  const desiredRole = role === "viewer" ? "viewer" : "editor"; // default editor

  const slug = params.slug;
  const userId = session.user.id;

  // 1) Find the document & ensure current user is the owner
  const { rows: docRows } = await db.execute(sql`
    SELECT id, owner_user_id
    FROM documents
    WHERE slug = ${slug}
    LIMIT 1
  `);
  if (docRows.length === 0) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  const docId = (docRows[0] as any).id as string;
  const ownerId = (docRows[0] as any).owner_user_id as string | null;

  if (ownerId !== userId) {
    return NextResponse.json({ error: "Only the owner can share" }, { status: 403 });
  }

  // 2) Find the invited user by email
  const { rows: userRows } = await db.execute(sql`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `);
  if (userRows.length === 0) {
    return NextResponse.json({ error: "No user with that email" }, { status: 404 });
  }
  const invitedUserId = (userRows[0] as any).id as string;

  if (invitedUserId === ownerId) {
    return NextResponse.json({ ok: true, info: "Owner already has access" });
  }

  // 3) Upsert into collaborators (ignore if already there)
  await db.execute(sql`
    INSERT INTO collaborators (document_id, user_id, role, first_joined_at, last_seen_at)
    VALUES (${docId}, ${invitedUserId}, ${desiredRole}, NOW(), NOW())
    ON CONFLICT (document_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, last_seen_at = NOW()
  `);

  return NextResponse.json({ ok: true });
}