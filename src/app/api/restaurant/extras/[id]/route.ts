import { db } from "@/db";
import { menuExtras } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const extraId = Number(id);
  if (Number.isNaN(extraId)) return Response.json({ error: "Invalid extra id" }, { status: 400 });

  const body = await request.json();
  const updates: Partial<typeof menuExtras.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.active === "boolean") updates.active = body.active;
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (Number.isNaN(price) || price < 0)
      return Response.json({ error: "Price must be a valid number" }, { status: 400 });
    updates.price = price;
  }

  const [updated] = await db.update(menuExtras).set(updates).where(eq(menuExtras.id, extraId)).returning();
  if (!updated) return Response.json({ error: "Extra not found" }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const extraId = Number(id);
  if (Number.isNaN(extraId)) return Response.json({ error: "Invalid extra id" }, { status: 400 });

  await db.delete(menuExtras).where(eq(menuExtras.id, extraId));
  return Response.json({ ok: true });
}
