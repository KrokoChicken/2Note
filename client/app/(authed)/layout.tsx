// app/(authed)/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar/Navbar";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <>
      <Navbar user={session.user} /> {/* can pass server user */}
      <main>{children}</main>
    </>
  );
}
