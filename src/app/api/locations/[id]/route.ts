import { db } from "@/db";
import { locations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const locationId = Number(id);
  if (Number.isNaN(locationId)) {
    return Response.json({ error: "Invalid location id" }, { status: 400 });
  }
  const body = await request.json();

  const updates: Partial<typeof locations.$inferInsert> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (body.deliveryCharge !== undefined) {
    const charge = Number(body.deliveryCharge);
    if (Number.isNaN(charge) || charge < 0) {
      return Response.json({ error: "Delivery charge must be a valid number" }, { status: 400 });
    }
    updates.deliveryCharge = charge;
  }
  if (typeof body.active === "boolean") updates.active = body.active;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db.update(locations).set(updates).where(eq(locations.id, locationId)).returning();
  if (!updated) {
    return Response.json({ error: "Location not found" }, { status: 404 });
  }
  return Response.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const locationId = Number(id);
  if (Number.isNaN(locationId)) {
    return Response.json({ error: "Invalid location id" }, { status: 400 });
  }
  await db.delete(locations).where(eq(locations.id, locationId));
  return Response.json({ ok: true });
}
