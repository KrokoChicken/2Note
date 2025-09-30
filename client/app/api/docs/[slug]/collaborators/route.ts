import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

// If you need auth here, you can add getServerSession(authOptions) like your other routes.
// For a read-only list it’s often fine to allow any collaborator/owner to fetch.
// Uncomment & adapt if needed:
//
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth.config";

type Mode = "personal" | "shared";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  // const session = await getServerSession(authOptions);
  // if (!session?.user?.id) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }
  // const requesterId = session.user.id;

  const { slug } = params;

  // 1) Find the document by slug
  const { rows: docRows } = await db.execute(sql`
    SELECT d.id, d.mode
    FROM documents d
    WHERE d.slug = ${slug}
    LIMIT 1
  `);
  if (docRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const doc = docRows[0] as { id: string; mode: Mode };

  // (Optional) You could verify the requester is owner/collaborator here
  // by checking collaborators table with requesterId.

  // 2) Return collaborators with basic user info for the panel
  const { rows } = await db.execute(sql`
    SELECT
      c.user_id        AS id,
      c.role           AS role,
      u.name           AS name,
      u.image          AS image
    FROM collaborators c
    JOIN users u ON u.id = c.user_id
    WHERE c.document_id = ${doc.id}
    ORDER BY u.name ASC
  `);

  return NextResponse.json({ collaborators: rows });
}