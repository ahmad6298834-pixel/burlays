import { db } from "@/db";
import { riders } from "@/db/schema";
import { authenticateRider } from "@/modules/authentication/auth.service";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Registers (or clears) the Expo push token for the logged-in rider's current device. */
export async function POST(request: NextRequest) {
  const rider = await authenticateRider(request);
  if (!rider) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const pushToken = typeof body.pushToken === "string" && body.pushToken.trim() ? body.pushToken.trim() : null;

  await db.update(riders).set({ pushToken }).where(eq(riders.id, rider.id));

  return Response.json({ ok: true });
}

/** Clears the push token on logout so a signed-out device stops receiving pushes. */
export async function DELETE(request: NextRequest) {
  const rider = await authenticateRider(request);
  if (!rider) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.update(riders).set({ pushToken: null }).where(eq(riders.id, rider.id));

  return Response.json({ ok: true });
}
