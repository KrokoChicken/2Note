import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";

type Mode = "personal" | "shared";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read body safely (default to "shared")
  let mode: Mode = "shared";
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.mode === "personal" || body?.mode === "shared") {
      mode = body.mode;
    }
  } catch {
    /* ignore malformed JSON; keep default */
  }

  const userId = session.user.id;
  const docId = randomUUID();
  const slug = nanoid(8);
  const title = "Untitled";

  // Insert document WITH mode
  await db.execute(sql`
    INSERT INTO documents (id, slug, title, owner_user_id, mode)
    VALUES (${docId}, ${slug}, ${title}, ${userId}, ${mode});
  `);

  // For shared docs, record the owner in collaborators (optional for personal)
  if (mode === "shared") {
    await db.execute(sql`
      INSERT INTO collaborators (document_id, user_id, role, first_joined_at, last_seen_at)
      VALUES (${docId}, ${userId}, 'owner', NOW(), NOW());
    `);
  }

  return NextResponse.json({ slug });
}