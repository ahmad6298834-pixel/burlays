import { db } from "@/db";
import { restaurantSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Restaurant info is a single row; create it on first read. */
async function getOrCreate() {
  const [existing] = await db.select().from(restaurantSettings).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(restaurantSettings).values({ name: "Burlays" }).returning();
  return created;
}

export async function GET() {
  return Response.json(await getOrCreate());
}

export async function PATCH(request: NextRequest) {
  const current = await getOrCreate();
  const body = await request.json();

  const updates: Partial<typeof restaurantSettings.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.phone === "string") updates.phone = body.phone.trim() || null;
  if (typeof body.address === "string") updates.address = body.address.trim() || null;
  if (typeof body.receiptFooter === "string") updates.receiptFooter = body.receiptFooter.trim() || null;

  const [updated] = await db
    .update(restaurantSettings)
    .set(updates)
    .where(eq(restaurantSettings.id, current.id))
    .returning();
  return Response.json(updated);
}
