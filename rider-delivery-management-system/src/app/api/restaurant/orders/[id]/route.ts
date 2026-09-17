import { upsertCustomer } from "@/modules/customers/customers.service";
import {
  assignRiderToRestaurantOrder,
  deleteRestaurantOrder,
  getRestaurantOrder,
  updateRestaurantOrder,
} from "@/modules/restaurant/pos.service";
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
 * Update an existing order.
 *
 * Two modes share this endpoint:
 *  - Full edit (from the Update Order screen): body contains `lines`. The order
 *    keeps its id and order number; customer, contact, location, delivery charge,
 *    menu lines, payment and rider are all updated in place. The linked delivery
 *    record (if any) is kept in sync so the rider app / earnings / reports stay
 *    correct.
 *  - Rider quick-assign (from the order listing): only `{ riderId }` is sent;
 *    this mode is unchanged.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderId = Number(id);
  if (Number.isNaN(orderId)) return Response.json({ error: "Invalid order id" }, { status: 400 });

  const body = await request.json();

  if (Array.isArray(body.lines)) {
    const result = await updateRestaurantOrder(orderId, {
      lines: body.lines,
      customerName: body.customerName ?? null,
      customerPhone: body.customerPhone ?? null,
      locationId: body.locationId === "" || body.locationId === null ? null : Number(body.locationId),
      riderId: body.riderId === "" || body.riderId === null ? null : Number(body.riderId),
      customerDeliveryCharge: body.customerDeliveryCharge,
      paymentMethod: body.paymentMethod,
    });
    if (result.error) return Response.json({ error: result.error }, { status: 400 });

    // Keep the customer master record in sync, mirroring the create flow.
    const order = result.order;
    if (order?.customerPhone && order.customerName) {
      await upsertCustomer({
        phone: order.customerPhone,
        name: order.customerName,
        locationId: order.locationId,
        locationName: order.locationName,
      });
    }
    return Response.json(order);
  }

  // Legacy / listing quick-patch: only rider id.
  if (body.riderId === undefined) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const riderId = body.riderId === null || body.riderId === "" ? null : Number(body.riderId);
  if (riderId !== null && Number.isNaN(riderId)) {
    return Response.json({ error: "Invalid rider" }, { status: 400 });
  }

  const result = await assignRiderToRestaurantOrder(orderId, riderId);
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.order);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderId = Number(id);
  if (Number.isNaN(orderId)) return Response.json({ error: "Invalid order id" }, { status: 400 });

  const result = await deleteRestaurantOrder(orderId);
  if (result.error) return Response.json({ error: result.error }, { status: 404 });
  return Response.json({ ok: true });
}
