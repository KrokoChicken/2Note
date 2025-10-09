// /app/(dashboard)/page.tsx
/*
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
  updated_at: string;
  updatedAtText: string;
  isOwner: boolean;
  mode: "personal" | "shared";
  folderId?: string | null; // ✅ added
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // ✅ Include folder_id in SELECT so the client can filter by folder
  const { rows } = await db.execute(sql`
    SELECT
      d.id,
      d.slug,
      d.title,
      d.updated_at,
      d.mode,
      d.folder_id AS "folderId",
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
      updated_at,
      updatedAtText: formatter.format(new Date(updated_at)),
      isOwner: Boolean(r.is_owner),
      mode: r.mode as "personal" | "shared",
      folderId: r.folderId ?? null, // ✅ add folder id to the returned object
    };
  });

  return <DashboardClient userName={session.user.name ?? "You"} docs={docs} />;
}
*/

// /app/(dashboard)/page.tsx
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
  updated_at: string;
  updatedAtText: string;
  isOwner: boolean;
  mode: "personal" | "shared";
  folderId?: string | null;
  folderName?: string | null; // 👈 added
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Include folder name via LEFT JOIN
  const { rows } = await db.execute(sql`
    SELECT
      d.id,
      d.slug,
      d.title,
      d.updated_at,
      d.mode,
      d.folder_id AS "folderId",
      (d.owner_user_id = ${userId}) AS is_owner,
      f.name AS "folderName"
    FROM documents d
    LEFT JOIN folders f ON f.id = d.folder_id
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
      updated_at,
      updatedAtText: formatter.format(new Date(updated_at)),
      isOwner: Boolean(r.is_owner),
      mode: r.mode as "personal" | "shared",
      folderId: r.folderId ?? null,
      folderName: r.folderName ?? null, // 👈 include it
    };
  });

  return <DashboardClient userName={session.user.name ?? "You"} docs={docs} />;
}
