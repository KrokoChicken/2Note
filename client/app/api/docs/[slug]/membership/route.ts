import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const slug = params.slug;

  const { rows: docRows } = await db.execute(sql`
    SELECT id, owner_user_id FROM documents WHERE slug = ${slug} LIMIT 1
  `);
  if (docRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const docId = (docRows[0] as any).id;
  const ownerId = (docRows[0] as any).owner_user_id;

  if (ownerId === userId) {
    return NextResponse.json(
      { error: "Owner cannot leave their own document. Delete or transfer ownership." },
      { status: 400 }
    );
  }

  await db.execute(sql`
    DELETE FROM collaborators
    WHERE document_id = ${docId} AND user_id = ${userId}
  `);

  return NextResponse.json({ ok: true });
}