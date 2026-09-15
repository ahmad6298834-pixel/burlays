import { db } from "@/db";
import { locations, orders, restaurantOrders } from "@/db/schema";
import { assignRiderToRestaurantOrder, getRestaurantOrder } from "@/modules/restaurant/pos.service";
import { getCurrentAdmin } from "@/modules/authentication/adminAuth.service";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderId = Number(id);
  if (Number.isNaN(orderId)) return Response.json({ error: "Invalid order id" }, { status: 400 });

  const order = await getRestaurantOrder(orderId);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json(order);
}

/**
 * Updates a restaurant order.
 *
 * Handles three concerns, all of which preserve the order's historical line-item
 * snapshots (item names/prices are never recalculated from the current menu):
 *  - rider assignment / re-assignment
 *  - payment verification (PENDING -> RECEIVED, with who/when)
 *  - editing customer details, location, delivery charge and payment method
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderId = Number(id);
  if (Number.isNaN(orderId)) return Response.json({ error: "Invalid order id" }, { status: 400 });

  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [existing] = await db
    .select()
    .from(restaurantOrders)
    .where(and(eq(restaurantOrders.id, orderId), isNull(restaurantOrders.deletedAt)))
    .limit(1);
  if (!existing) return Response.json({ error: "Order not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  // --- Rider assignment (delegates to the shared service so notifications fire) ---
  if (body.riderId !== undefined) {
    const riderId = body.riderId === null || body.riderId === "" ? null : Number(body.riderId);
    if (riderId !== null && Number.isNaN(riderId)) {
      return Response.json({ error: "Invalid rider" }, { status: 400 });
    }
    const result = await assignRiderToRestaurantOrder(orderId, riderId);
    if (result.error) return Response.json({ error: result.error }, { status: 400 });
    if (Object.keys(body).length === 1) return Response.json(result.order);
  }

  const updates: Partial<typeof restaurantOrders.$inferInsert> = {};

  // --- Payment verification ---
  if (body.paymentStatus !== undefined) {
    const next = String(body.paymentStatus).toUpperCase();
    if (next !== "PENDING" && next !== "RECEIVED") {
      return Response.json({ error: "Invalid payment status" }, { status: 400 });
    }
    // Idempotent: verifying an already-verified order changes nothing.
    if (next === "RECEIVED" && existing.paymentStatus === "RECEIVED") {
      return Response.json(await getRestaurantOrder(orderId));
    }
    updates.paymentStatus = next;
    updates.paymentVerifiedAt = next === "RECEIVED" ? new Date() : null;
    updates.paymentVerifiedBy = next === "RECEIVED" ? admin.name || admin.username : null;
  }

  // --- Editable order details ---
  if (typeof body.customerName === "string") updates.customerName = body.customerName.trim() || null;
  if (typeof body.customerPhone === "string") updates.customerPhone = body.customerPhone.trim() || null;
  if (typeof body.paymentMethod === "string" && body.paymentMethod) updates.paymentMethod = body.paymentMethod;
  if (typeof body.status === "string" && body.status) updates.status = body.status;

  if (body.locationId !== undefined) {
    const locationId = body.locationId === null || body.locationId === "" ? null : Number(body.locationId);
    if (locationId === null) {
      updates.locationId = null;
      updates.locationName = null;
      updates.riderDeliveryEarning = 0;
    } else {
      const [loc] = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
      if (!loc) return Response.json({ error: "Location not found" }, { status: 404 });
      updates.locationId = loc.id;
      updates.locationName = loc.name;
      // Rider earning always follows the location's configured charge — never the
      // customer delivery charge, which the admin sets independently below.
      updates.riderDeliveryEarning = Number(loc.deliveryCharge);
      // Suggest the configured charge to the customer only if none was supplied.
      if (body.customerDeliveryCharge === undefined) {
        updates.customerDeliveryCharge = Number(loc.deliveryCharge);
      }
    }
  }

  if (body.customerDeliveryCharge !== undefined) {
    const charge = Number(body.customerDeliveryCharge);
    if (Number.isNaN(charge) || charge < 0) {
      return Response.json({ error: "Customer delivery charge must be a valid number" }, { status: 400 });
    }
    updates.customerDeliveryCharge = charge;
  }

  // Totals are recalculated from the UNCHANGED subtotal snapshot, so editing an
  // order never re-prices its historical line items.
  if (updates.customerDeliveryCharge !== undefined) {
    updates.total = Number(existing.subtotal) + Number(updates.customerDeliveryCharge);
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(await getRestaurantOrder(orderId));
  }

  await db.update(restaurantOrders).set(updates).where(eq(restaurantOrders.id, orderId));

  // Keep the linked delivery order in step so rider earnings/reports stay correct.
  if (existing.deliveryOrderId) {
    const deliveryUpdates: Partial<typeof orders.$inferInsert> = {};
    if (updates.customerName !== undefined) deliveryUpdates.customerName = updates.customerName ?? "Walk-in";
    if (updates.customerPhone !== undefined) deliveryUpdates.customerPhone = updates.customerPhone;
    if (updates.locationId !== undefined) {
      deliveryUpdates.locationId = updates.locationId;
      deliveryUpdates.locationName = updates.locationName ?? "";
      deliveryUpdates.deliveryCharge = updates.riderDeliveryEarning ?? 0;
    }
    if (updates.paymentMethod) deliveryUpdates.paymentMethod = updates.paymentMethod;
    if (updates.total !== undefined) deliveryUpdates.totalBill = updates.total;
    if (Object.keys(deliveryUpdates).length > 0) {
      await db.update(orders).set(deliveryUpdates).where(eq(orders.id, existing.deliveryOrderId));
    }
  }

  return Response.json(await getRestaurantOrder(orderId));
}

/**
 * Soft-deletes a restaurant order so historical records survive, while removing
 * it from the orders list, dashboard totals and all sales reports. The linked
 * delivery order is hard-deleted so it also leaves rider earnings and the daily
 * rider report (it is fully reconstructible from this record if ever needed).
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderId = Number(id);
  if (Number.isNaN(orderId)) return Response.json({ error: "Invalid order id" }, { status: 400 });

  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [existing] = await db
    .select()
    .from(restaurantOrders)
    .where(and(eq(restaurantOrders.id, orderId), isNull(restaurantOrders.deletedAt)))
    .limit(1);
  if (!existing) return Response.json({ error: "Order not found" }, { status: 404 });

  await db.update(restaurantOrders).set({ deletedAt: new Date() }).where(eq(restaurantOrders.id, orderId));

  if (existing.deliveryOrderId) {
    await db.delete(orders).where(eq(orders.id, existing.deliveryOrderId));
    await db
      .update(restaurantOrders)
      .set({ deliveryOrderId: null })
      .where(eq(restaurantOrders.id, orderId));
  }

  return Response.json({ ok: true });
}
