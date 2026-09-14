import { db } from "@/db";
import { orders } from "@/db/schema";
import { authenticateRider } from "@/modules/authentication/auth.service";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function todayServerISO() {
  const now = new Date();
  const tz = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

function nowTimeHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Rider explicitly confirms delivery. Opening/viewing an order never triggers this. */
export async function POST(request: NextRequest, { params }: Params) {
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
  if (order.riderId !== rider.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status === "Delivered") {
    return Response.json({ error: "Order is already marked as delivered" }, { status: 400 });
  }
  if (order.status === "Cancelled") {
    return Response.json({ error: "Cancelled orders cannot be marked as delivered" }, { status: 400 });
  }

  const [updated] = await db
    .update(orders)
    .set({
      status: "Delivered",
      deliveredDate: todayServerISO(),
      deliveredTime: nowTimeHHMM(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return Response.json(updated);
}
