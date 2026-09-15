import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentAdmin } from "@/modules/authentication/adminAuth.service";

/**
 * Authoritative auth gate for every admin page. Middleware only checks that a
 * cookie exists; here the token signature is verified and the admin is re-read
 * from the database, so a forged or stale cookie is rejected.
 */
export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return <AppShell adminName={admin.name}>{children}</AppShell>;
}
