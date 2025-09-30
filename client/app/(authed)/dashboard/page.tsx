import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";
export const fetchCache = "default-no-store";

type Doc = {
  id: string;
  slug: string;
  title: string;
  updated_at: string; // snake_case because DashboardClient expects this
  updatedAtText: string; // human readable
  isOwner: boolean;
  mode: "personal" | "shared";
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Use EXISTS to avoid duplicates if multiple collaborator rows exist
  const { rows } = await db.execute(sql`
    SELECT
      d.id,
      d.slug,
      d.title,
      d.updated_at,
      d.mode,
      (d.owner_user_id = ${userId}) AS is_owner
    FROM documents d
    WHERE
      d.owner_user_id = ${userId}
      OR (
        d.mode = 'shared'
        AND EXISTS (
          SELECT 1
          FROM collaborators c
          WHERE c.document_id = d.id
            AND c.user_id = ${userId}
        )
      )
    ORDER BY d.updated_at DESC
  `);

  // Format dates server-side (Europe/Copenhagen per your environment)
  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Copenhagen",
  });

  const docs: Doc[] = (rows as any[]).map((r) => {
    const updated_at = String(r.updated_at);
    return {
      id: String(r.id),
      slug: String(r.slug),
      title: String(r.title),
      updated_at, // matches DashboardClient's expected field
      updatedAtText: formatter.format(new Date(updated_at)),
      isOwner: Boolean(r.is_owner),
      mode: r.mode as "personal" | "shared",
    };
  });

  return <DashboardClient userName={session.user.name ?? "You"} docs={docs} />;
}
