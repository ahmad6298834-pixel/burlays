import { db } from "@/db";
import { orders, riders } from "@/db/schema";
import { hashPassword } from "@/modules/authentication/auth.service";
import { getRiderLedger } from "@/modules/riders/riderFinancials.service";
import { and, desc, eq, ne } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const riderId = Number(id);
  if (Number.isNaN(riderId)) {
    return Response.json({ error: "Invalid rider id" }, { status: 400 });
  }

  const ledgerData = await getRiderLedger(riderId);
  if (!ledgerData) {
    return Response.json({ error: "Rider not found" }, { status: 404 });
  }

  const history = await db
    .select()
    .from(orders)
    .where(eq(orders.riderId, riderId))
    .orderBy(desc(orders.orderDate), desc(orders.createdAt));

  const { passwordHash: _passwordHash, pushToken: _pushToken, ...safeRider } = ledgerData.rider;

  return Response.json({ ...ledgerData, rider: safeRider, history });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const riderId = Number(id);
  if (Number.isNaN(riderId)) {
    return Response.json({ error: "Invalid rider id" }, { status: 400 });
  }
  const body = await request.json();

  const updates: Partial<typeof riders.$inferInsert> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.phone === "string") updates.phone = body.phone.trim() || null;
  if (typeof body.active === "boolean") updates.active = body.active;

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (email) {
      const [existing] = await db
        .select()
        .from(riders)
        .where(and(eq(riders.email, email), ne(riders.id, riderId)))
        .limit(1);
      if (existing) {
        return Response.json({ error: "A rider with this email already exists" }, { status: 409 });
      }
      updates.email = email;
    } else {
      updates.email = null;
    }
  }

  if (typeof body.password === "string" && body.password.trim()) {
    updates.passwordHash = await hashPassword(body.password.trim());
  }

  // Defense in depth: immediately clear the rider's push token when deactivated so a
  // stale device token can never receive a "New Order Ready" notification, even though
  // notifyRiderOfNewOrder() also independently checks `active` before sending.
  if (updates.active === false) {
    updates.pushToken = null;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db.update(riders).set(updates).where(eq(riders.id, riderId)).returning();
  if (!updated) {
    return Response.json({ error: "Rider not found" }, { status: 404 });
  }
  const { passwordHash: _ph, pushToken: _pt, ...safeUpdated } = updated;
  return Response.json(safeUpdated);
}

/**
 * Permanently deletes a rider record (and their advance/payment transactions,
 * via the DB cascade). Any orders previously assigned to this rider are kept —
 * the order's riderId is set to null while the historical riderName snapshot
 * stays on the order, so past reports and printed slips remain accurate.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const riderId = Number(id);
  if (Number.isNaN(riderId)) {
    return Response.json({ error: "Invalid rider id" }, { status: 400 });
  }

  const [existing] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
  if (!existing) {
    return Response.json({ error: "Rider not found" }, { status: 404 });
  }

  await db.delete(riders).where(eq(riders.id, riderId));
  return Response.json({ ok: true });
}
