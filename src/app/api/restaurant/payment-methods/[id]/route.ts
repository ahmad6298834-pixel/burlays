import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const methodId = Number(id);
  if (Number.isNaN(methodId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  const body = await request.json();
  const updates: Partial<typeof paymentMethods.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.active === "boolean") updates.active = body.active;
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder)))
    updates.sortOrder = Number(body.sortOrder);

  const [updated] = await db.update(paymentMethods).set(updates).where(eq(paymentMethods.id, methodId)).returning();
  if (!updated) return Response.json({ error: "Payment method not found" }, { status: 404 });
  return Response.json(updated);
}

/**
 * Hard delete is allowed because past orders snapshot their payment method as
 * plain text — removing the option here can never alter a historical receipt.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const methodId = Number(id);
  if (Number.isNaN(methodId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  await db.delete(paymentMethods).where(eq(paymentMethods.id, methodId));
  return Response.json({ ok: true });
}
