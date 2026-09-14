import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { hashPassword, verifyPassword } from "./auth.service";

/**
 * Admin (back-office) authentication.
 *
 * Completely separate from rider authentication in `auth.service.ts`, which the
 * Android app uses — the two flows share only the bcrypt helpers, so changing
 * admin login can never affect the Rider App.
 *
 * The session is a signed JWT stored in an httpOnly cookie, so the token is
 * never readable by frontend JavaScript. The signing secret comes from the
 * ADMIN_SESSION_SECRET environment variable.
 */

const SECRET = process.env.ADMIN_SESSION_SECRET ?? "burlays_admin_dev_secret_change_me";
const COOKIE = "burlays_admin_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

export type AdminSession = { adminId: number; username: string; role: string; v: number };

/** Seeds the initial Super Admin once. Credentials live only in the database. */
export async function ensureSuperAdmin() {
  const existing = await db.select().from(adminUsers).limit(1);
  if (existing.length > 0) return;

  // Initial setup credentials — the password is hashed before it is stored and
  // the admin is expected to change it from My Profile after first login.
  const passwordHash = await hashPassword("Admin@123");
  await db.insert(adminUsers).values({
    name: "Super Admin",
    username: "admin",
    email: null,
    passwordHash,
    role: "SUPER_ADMIN",
  });
}

/** Verifies credentials and returns the admin record, or null. */
export async function verifyAdminCredentials(identifier: string, password: string) {
  await ensureSuperAdmin();
  const id = identifier.trim().toLowerCase();
  if (!id || !password) return null;

  const all = await db.select().from(adminUsers);
  const admin = all.find(
    (a) => a.username.toLowerCase() === id || (a.email && a.email.toLowerCase() === id)
  );
  if (!admin || !admin.active) return null;

  const ok = await verifyPassword(password, admin.passwordHash);
  return ok ? admin : null;
}

export function signAdminToken(session: AdminSession): string {
  return jwt.sign(session, SECRET, { expiresIn: MAX_AGE });
}

export function verifyAdminToken(token: string): AdminSession | null {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (typeof decoded === "object" && decoded && "adminId" in decoded) return decoded as AdminSession;
    return null;
  } catch {
    return null;
  }
}

export async function createSession(session: AdminSession) {
  const store = await cookies();
  store.set(COOKIE, signAdminToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/**
 * Logout. Clears the cookie AND bumps the admin's sessionVersion, so any token
 * issued before this moment is rejected from now on — the session is genuinely
 * invalidated server-side, not just forgotten by the browser.
 */
export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  const session = token ? verifyAdminToken(token) : null;
  if (session) {
    await db
      .update(adminUsers)
      .set({ sessionVersion: sql`${adminUsers.sessionVersion} + 1` })
      .where(eq(adminUsers.id, session.adminId));
  }
  store.delete(COOKIE);
}

/** Full verification used by the proxy and the protected layout. */
export async function resolveAdminFromToken(token: string | undefined) {
  if (!token) return null;
  const session = verifyAdminToken(token);
  if (!session) return null;

  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.adminId)).limit(1);
  if (!admin || !admin.active) return null;
  // Reject tokens issued before the last logout / password change.
  if (session.v !== admin.sessionVersion) return null;
  return admin;
}

/**
 * Returns the signed-in admin, re-reading the database so a deactivated or
 * deleted admin is rejected immediately even with a still-valid token.
 */
export async function getCurrentAdmin() {
  const store = await cookies();
  const admin = await resolveAdminFromToken(store.get(COOKIE)?.value);
  if (!admin) return null;
  const { passwordHash: _ph, ...safe } = admin;
  return safe;
}

export const ADMIN_COOKIE_NAME = COOKIE;
