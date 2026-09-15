import { NextRequest, NextResponse } from "next/server";
import { resolveAdminFromToken } from "@/modules/authentication/adminAuth.service";

/**
 * Auth gate (Next.js proxy) for all admin pages and admin APIs.
 *
 * The proxy runs on the Node.js runtime, so the session JWT signature is fully
 * verified here. A stale, expired or forged cookie is rejected before reaching
 * any page or API, and the protected layout re-checks the database as a second
 * layer (catching admins deactivated after their token was issued).
 */
const COOKIE = "burlays_admin_session";

/** Paths that must stay reachable while signed out. */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/admin-auth", // admin login/logout
  "/api/rider-auth", // Rider Android App login — must never be gated
  "/api/rider", // Rider App endpoints use their own Bearer token auth
  "/api/health",
  "/api/files", // served menu/deal images
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Segment-aware match only. A loose startsWith would wrongly treat the admin
  // route "/api/riders" as the public rider-app prefix "/api/rider".
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
    return NextResponse.next();
  }

  const admin = await resolveAdminFromToken(request.cookies.get(COOKIE)?.value);
  if (admin) return NextResponse.next();

  // Unauthenticated API calls get a 401 instead of an HTML redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Protect everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
