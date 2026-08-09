import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminStationMatcher } from "@/app/components/AdminStationMatcher";
import { auth } from "@/app/lib/auth";
import { isAdminEmail } from "@/app/lib/adminAuth";

export const metadata: Metadata = {
  title: "Review workspace",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) redirect("/login");
  if (!isAdminEmail(session.user.email)) notFound();
  return <AdminStationMatcher />;
}
