import { db } from "@/db";
import { riders } from "@/db/schema";
import { signRiderToken, verifyPassword } from "@/modules/authentication/auth.service";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  const [rider] = await db.select().from(riders).where(eq(riders.email, email)).limit(1);

  if (!rider || !rider.passwordHash) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await verifyPassword(password, rider.passwordHash);
  if (!valid) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (!rider.active) {
    return Response.json(
      { error: "Your account has been deactivated. Please contact the administrator." },
      { status: 403 }
    );
  }

  const token = signRiderToken({ riderId: rider.id, email: rider.email ?? email });

  return Response.json({
    token,
    rider: {
      id: rider.id,
      name: rider.name,
      email: rider.email,
      phone: rider.phone,
      active: rider.active,
    },
  });
}
