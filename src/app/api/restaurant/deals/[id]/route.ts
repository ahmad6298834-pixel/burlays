import { db } from "@/db";
import { deals } from "@/db/schema";
import { replaceDealItems } from "@/modules/restaurant/restaurant.service";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const dealId = Number(id);
  if (Number.isNaN(dealId)) return Response.json({ error: "Invalid deal id" }, { status: 400 });

  const body = await request.json();
  const updates: Partial<typeof deals.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  // Empty string clears the picture (Remove image).
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl ? String(body.imageUrl) : null;
  if (typeof body.active === "boolean") updates.active = body.active;
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (Number.isNaN(price) || price < 0)
      return Response.json({ error: "Deal price must be a valid number" }, { status: 400 });
    updates.price = price;
  }

  const [updated] = await db.update(deals).set(updates).where(eq(deals.id, dealId)).returning();
  if (!updated) return Response.json({ error: "Deal not found" }, { status: 404 });

  if (Array.isArray(body.items)) await replaceDealItems(dealId, body.items);

  return Response.json(updated);
}

/** Deals own their line items, so deleting a deal cleanly removes them (cascade). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const dealId = Number(id);
  if (Number.isNaN(dealId)) return Response.json({ error: "Invalid deal id" }, { status: 400 });

  await db.delete(deals).where(eq(deals.id, dealId));
  return Response.json({ ok: true });
}
