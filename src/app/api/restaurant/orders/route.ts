import { createRestaurantOrder, generateOrderNumber, listRestaurantOrders } from "@/modules/restaurant/pos.service";
import { upsertCustomer } from "@/modules/customers/customers.service";
import { ORDER_TYPES } from "@/types";
import type { RestaurantOrderType } from "@/types";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // ?preview=number returns the order number the next save will most likely use,
  // so the POS can display it. The authoritative number is assigned on save.
  const { searchParams } = new URL(request.url);
  if (searchParams.get("preview") === "number") {
    return Response.json({ orderNumber: await generateOrderNumber() });
  }
  return Response.json(await listRestaurantOrders());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const orderType = String(body.orderType ?? "") as RestaurantOrderType;

  if (!ORDER_TYPES.includes(orderType)) {
    return Response.json({ error: "Invalid order type" }, { status: 400 });
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return Response.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Delivery needs enough information to actually deliver the order.
  if (orderType === "delivery") {
    if (!String(body.customerName ?? "").trim())
      return Response.json({ error: "Customer name is required for delivery" }, { status: 400 });
    if (!String(body.customerPhone ?? "").trim())
      return Response.json({ error: "Customer phone is required for delivery" }, { status: 400 });
    if (!body.locationId)
      return Response.json({ error: "Delivery location is required for delivery" }, { status: 400 });
  }

  const result = await createRestaurantOrder({
    orderType,
    clientRequestId: typeof body.clientRequestId === "string" ? body.clientRequestId : null,
    lines: body.lines,
    // Dine-in never stores customer details; takeaway keeps them optional.
    customerName: orderType === "dine-in" ? null : body.customerName,
    customerPhone: orderType === "dine-in" ? null : body.customerPhone,
    locationId: orderType === "delivery" ? body.locationId : null,
    riderId: orderType === "delivery" ? body.riderId : null,
    customerDeliveryCharge: body.customerDeliveryCharge,
    paymentMethod: body.paymentMethod,
  });

  if (result.error) return Response.json({ error: result.error }, { status: 400 });

  // Reuse the existing customer master record so phone lookup keeps working
  // across both the delivery module and the POS.
  const order = result.order!;
  if (order.customerPhone && order.customerName) {
    await upsertCustomer({
      phone: order.customerPhone,
      name: order.customerName,
      locationId: order.locationId,
      locationName: order.locationName,
    });
  }

  return Response.json(order, { status: 201 });
}
