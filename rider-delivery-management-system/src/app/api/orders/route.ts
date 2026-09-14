import { db } from "@/db";
import { locations, orders, riders } from "@/db/schema";
import { normalizePhone, upsertCustomer } from "@/modules/customers/customers.service";
import { notifyRiderOfNewOrder } from "@/services/pushNotifications";
import { and, desc, eq, ilike, sql, SQL } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const riderId = searchParams.get("riderId");
  const locationId = searchParams.get("locationId");
  const customerName = searchParams.get("customerName");
  const customerPhone = searchParams.get("customerPhone");
  const orderNumber = searchParams.get("orderNumber");
  const date = searchParams.get("date");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const conditions: SQL[] = [];
  if (riderId) conditions.push(eq(orders.riderId, Number(riderId)));
  if (locationId) conditions.push(eq(orders.locationId, Number(locationId)));
  if (customerName) conditions.push(ilike(orders.customerName, `%${customerName}%`));
  if (customerPhone) conditions.push(ilike(orders.customerPhone, `%${customerPhone}%`));
  if (orderNumber) conditions.push(ilike(orders.orderNumber, `%${orderNumber}%`));
  if (date) conditions.push(eq(orders.orderDate, date));
  if (status) conditions.push(eq(orders.status, status));
  if (search) {
    conditions.push(
      sql`(${orders.customerName} ilike ${"%" + search + "%"} or ${orders.orderNumber} ilike ${
        "%" + search + "%"
      } or ${orders.riderName} ilike ${"%" + search + "%"} or ${orders.locationName} ilike ${
        "%" + search + "%"
      } or ${orders.customerPhone} ilike ${"%" + search + "%"})`
    );
  }

  const list = await db
    .select()
    .from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.orderDate), desc(orders.createdAt));

  return Response.json(list);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const riderId = Number(body.riderId);
  const locationId = Number(body.locationId);
  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = normalizePhone(String(body.customerPhone ?? ""));
  const totalBill = Number(body.totalBill);
  const paymentMethod = String(body.paymentMethod ?? "Cash");
  const orderDate = String(body.orderDate ?? "").trim();
  const orderTime = String(body.orderTime ?? "").trim();
  const status = String(body.status ?? "Assigned");
  let orderNumber = String(body.orderNumber ?? "").trim();

  if (!riderId || Number.isNaN(riderId)) {
    return Response.json({ error: "Rider is required" }, { status: 400 });
  }
  if (!locationId || Number.isNaN(locationId)) {
    return Response.json({ error: "Delivery location is required" }, { status: 400 });
  }
  if (!customerName) {
    return Response.json({ error: "Customer name is required" }, { status: 400 });
  }
  if (Number.isNaN(totalBill) || totalBill < 0) {
    return Response.json({ error: "Total bill must be a valid number" }, { status: 400 });
  }
  if (!orderDate || !orderTime) {
    return Response.json({ error: "Order date and time are required" }, { status: 400 });
  }

  const [rider] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
  if (!rider) {
    return Response.json({ error: "Rider not found" }, { status: 404 });
  }
  const [location] = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location) {
    return Response.json({ error: "Location not found" }, { status: 404 });
  }

  if (!orderNumber) {
    const stamp = orderDate.replace(/-/g, "");
    orderNumber = `INV-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const deliveryCharge =
    body.deliveryCharge !== undefined && body.deliveryCharge !== null
      ? Number(body.deliveryCharge)
      : Number(location.deliveryCharge);

  // Keep the customer master record (used for phone-number auto-fill) in sync with the
  // latest name/location entered — but this NEVER rewrites the order snapshot below.
  if (customerPhone) {
    await upsertCustomer({
      phone: customerPhone,
      name: customerName,
      locationId: location.id,
      locationName: location.name,
    });
  }

  const [created] = await db
    .insert(orders)
    .values({
      orderNumber,
      riderId: rider.id,
      riderName: rider.name,
      customerName,
      customerPhone: customerPhone || null,
      locationId: location.id,
      locationName: location.name,
      deliveryCharge,
      totalBill,
      paymentMethod,
      orderDate,
      orderTime,
      status,
      deliveredDate: status === "Delivered" ? orderDate : null,
      deliveredTime: status === "Delivered" ? orderTime : null,
    })
    .returning();

  // Notify the rider's Android app that a new order is ready — only meaningful while
  // the order is still "Assigned" (not if it was created as already Delivered/Cancelled).
  if (created.status === "Assigned") {
    void notifyRiderOfNewOrder(rider, created);
  }

  return Response.json(created, { status: 201 });
}
