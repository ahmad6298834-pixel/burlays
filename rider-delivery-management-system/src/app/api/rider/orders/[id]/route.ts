import { db } from "@/db";
import { orders } from "@/db/schema";
import { authenticateRider } from "@/modules/authentication/auth.service";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const rider = await authenticateRider(request);
  if (!rider) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (Number.isNaN(orderId)) {
    return Response.json({ error: "Invalid order id" }, { status: 400 });
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }

  // Security: a rider must never access another rider's order.
  if (order.riderId !== rider.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(order);
}
