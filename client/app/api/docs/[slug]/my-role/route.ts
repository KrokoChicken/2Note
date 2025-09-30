import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Mode = "personal" | "shared";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { slug } = params;

  // Load doc (id, owner, mode)
  const { rows: docRows } = await db.execute(sql`
    SELECT d.id, d.owner_user_id, d.mode
    FROM documents d
    WHERE d.slug = ${slug}
    LIMIT 1
  `);
  if (docRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const doc = docRows[0] as {
    id: string;
    owner_user_id: string | null;
    mode: Mode | null;
  };

  // Owner is always "owner"
  if (doc.owner_user_id === userId) {
    return NextResponse.json(
      { role: "owner" as const },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Shared docs: look up collaborator role
  if ((doc.mode ?? "shared") === "shared") {
    const { rows: collabRows } = await db.execute(sql`
      SELECT role
      FROM collaborators
      WHERE document_id = ${doc.id} AND user_id = ${userId}
      LIMIT 1
    `);
    if (collabRows.length) {
      return NextResponse.json(
        { role: (collabRows[0] as any).role as "editor" | "viewer" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  // Not owner and not a collaborator anymore -> tell client to eject
  return NextResponse.json(
    { role: "none" as const },
    { headers: { "Cache-Control": "no-store" } }
  );
}