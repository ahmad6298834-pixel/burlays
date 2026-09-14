import { db } from "@/db";
import { locations, orders, riders } from "@/db/schema";
import { normalizePhone, upsertCustomer } from "@/modules/customers/customers.service";
import { notifyRiderOfNewOrder } from "@/services/pushNotifications";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderId = Number(id);
  if (Number.isNaN(orderId)) {
    return Response.json({ error: "Invalid order id" }, { status: 400 });
  }
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }
  return Response.json(order);
}

/**
 * Super Admin can edit ANY field of an order after it has been assigned.
 * - Changing the rider moves the order (and its earnings) from the old rider to the new
 *   one, and — if the order is still "Assigned" — sends the new rider a fresh
 *   "New Order Ready" push notification (the old rider receives nothing further; the
 *   order simply disappears from their pending list since it's no longer theirs).
 * - Changing the location refreshes the delivery charge suggestion, but the admin can
 *   still override the charge manually.
 * - Because dashboards / reports / ledgers are always computed live from the orders
 *   table, updating a record here automatically keeps all of them correct.
 * - Editing customer name/phone/location here also refreshes the customer master
 *   record used for future phone-number auto-fill, without touching any other
 *   historical order.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderId = Number(id);
  if (Number.isNaN(orderId)) {
    return Response.json({ error: "Invalid order id" }, { status: 400 });
  }
  const body = await request.json();

  const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!existing) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }

  const updates: Partial<typeof orders.$inferInsert> = {};
  const previousRiderId = existing.riderId;
  let newRiderForNotification: typeof riders.$inferSelect | null = null;

  if (body.riderId !== undefined) {
    const riderId = Number(body.riderId);
    if (Number.isNaN(riderId)) {
      return Response.json({ error: "Invalid rider" }, { status: 400 });
    }
    const [rider] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
    if (!rider) {
      return Response.json({ error: "Rider not found" }, { status: 404 });
    }
    updates.riderId = rider.id;
    updates.riderName = rider.name;
    if (previousRiderId !== rider.id) {
      newRiderForNotification = rider;
    }
  }

  if (body.locationId !== undefined) {
    const locationId = Number(body.locationId);
    if (Number.isNaN(locationId)) {
      return Response.json({ error: "Invalid location" }, { status: 400 });
    }
    const [location] = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
    if (!location) {
      return Response.json({ error: "Location not found" }, { status: 404 });
    }
    updates.locationId = location.id;
    updates.locationName = location.name;
    // Suggest the location's current charge unless the admin explicitly supplies one below.
    if (body.deliveryCharge === undefined) {
      updates.deliveryCharge = Number(location.deliveryCharge);
    }
  }

  if (typeof body.orderNumber === "string" && body.orderNumber.trim())
    updates.orderNumber = body.orderNumber.trim();
  if (typeof body.status === "string" && body.status) updates.status = body.status;
  if (typeof body.customerName === "string" && body.customerName.trim())
    updates.customerName = body.customerName.trim();
  if (typeof body.customerPhone === "string") {
    updates.customerPhone = normalizePhone(body.customerPhone) || null;
  }
  if (body.totalBill !== undefined) {
    const totalBill = Number(body.totalBill);
    if (Number.isNaN(totalBill) || totalBill < 0) {
      return Response.json({ error: "Total bill must be a valid number" }, { status: 400 });
    }
    updates.totalBill = totalBill;
  }
  if (body.deliveryCharge !== undefined) {
    const deliveryCharge = Number(body.deliveryCharge);
    if (Number.isNaN(deliveryCharge) || deliveryCharge < 0) {
      return Response.json({ error: "Delivery charge must be a valid number" }, { status: 400 });
    }
    updates.deliveryCharge = deliveryCharge;
  }
  if (typeof body.paymentMethod === "string" && body.paymentMethod) updates.paymentMethod = body.paymentMethod;
  if (typeof body.orderDate === "string" && body.orderDate) updates.orderDate = body.orderDate;
  if (typeof body.orderTime === "string" && body.orderTime) updates.orderTime = body.orderTime;

  // If admin manually reverts a delivered order back to Assigned/Cancelled, clear the
  // delivered timestamp so reports don't keep a stale delivery time.
  if (updates.status && updates.status !== "Delivered" && existing.status === "Delivered") {
    updates.deliveredDate = null;
    updates.deliveredTime = null;
  }
  if (updates.status === "Delivered" && existing.status !== "Delivered" && !existing.deliveredDate) {
    updates.deliveredDate = existing.orderDate;
    updates.deliveredTime = existing.orderTime;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db.update(orders).set(updates).where(eq(orders.id, orderId)).returning();
  if (!updated) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }

  // Keep the customer master record in sync with the latest edited name/phone/location,
  // without ever touching this or any other order's own saved snapshot.
  const finalPhone = updated.customerPhone;
  if (finalPhone) {
    await upsertCustomer({
      phone: finalPhone,
      name: updated.customerName,
      locationId: updated.locationId,
      locationName: updated.locationName,
    });
  }

  // Rider was changed to someone new: remove-from-old/add-to-new happens automatically
  // (riderId is the single source of truth for "whose pending list" an order is in).
  // Notify the new rider only if the order is still awaiting delivery.
  if (newRiderForNotification && updated.status === "Assigned") {
    void notifyRiderOfNewOrder(newRiderForNotification, updated);
  }

  return Response.json(updated);
}

/**
 * Permanently deletes an order/delivery record. Because dashboards, the daily
 * report, and rider ledgers/earnings are always computed live from the orders
 * table, removing an order here automatically drops it from all of those views.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderId = Number(id);
  if (Number.isNaN(orderId)) {
    return Response.json({ error: "Invalid order id" }, { status: 400 });
  }

  const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!existing) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }

  await db.delete(orders).where(eq(orders.id, orderId));
  return Response.json({ ok: true });
}
