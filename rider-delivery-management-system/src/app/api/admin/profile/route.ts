import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/modules/authentication/auth.service";
import { getCurrentAdmin } from "@/modules/authentication/adminAuth.service";
import { and, eq, ne } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(admin);
}

/** Updates profile details and/or password. Never returns the password hash. */
export async function PATCH(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const updates: Partial<typeof adminUsers.$inferInsert> = { updatedAt: new Date() };

  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.email === "string") updates.email = body.email.trim() || null;

  if (typeof body.username === "string" && body.username.trim()) {
    const username = body.username.trim();
    const [clash] = await db
      .select()
      .from(adminUsers)
      .where(and(eq(adminUsers.username, username), ne(adminUsers.id, admin.id)))
      .limit(1);
    if (clash) return Response.json({ error: "That username is already taken" }, { status: 409 });
    updates.username = username;
  }

  // Password change requires proving knowledge of the current password.
  if (body.newPassword) {
    const current = String(body.currentPassword ?? "");
    const next = String(body.newPassword);
    const confirm = String(body.confirmPassword ?? "");

    const [full] = await db.select().from(adminUsers).where(eq(adminUsers.id, admin.id)).limit(1);
    if (!full || !(await verifyPassword(current, full.passwordHash))) {
      return Response.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    if (next.length < 8) {
      return Response.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    if (next !== confirm) {
      return Response.json({ error: "New password and confirmation do not match" }, { status: 400 });
    }
    updates.passwordHash = await hashPassword(next);
    // Invalidate every previously issued token after a password change.
    updates.sessionVersion = full.sessionVersion + 1;
  }

  const [updated] = await db.update(adminUsers).set(updates).where(eq(adminUsers.id, admin.id)).returning();
  const { passwordHash: _ph, ...safe } = updated;
  return Response.json(safe);
}
