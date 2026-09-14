import { assignRiderToRestaurantOrder, getRestaurantOrder } from "@/modules/restaurant/pos.service";
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
 * Assign or re-assign the rider on a DELIVERY order. The linked delivery order is
 * the source of truth, so existing rider earnings, ledger, reports and the
 * "New Order Ready" notification all continue to work unchanged.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderId = Number(id);
  if (Number.isNaN(orderId)) return Response.json({ error: "Invalid order id" }, { status: 400 });

  const body = await request.json();
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
