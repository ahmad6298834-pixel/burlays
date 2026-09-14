import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const riderId = searchParams.get("riderId");

  if (!date) {
    return Response.json({ error: "Date is required" }, { status: 400 });
  }

  const conditions = [eq(orders.orderDate, date), eq(orders.status, "Delivered")];
  if (riderId) conditions.push(eq(orders.riderId, Number(riderId)));

  const delivered = await db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(asc(orders.orderTime));

  const groups = new Map<
    string,
    { riderId: number | null; riderName: string; orders: typeof delivered; totalDeliveryCharges: number; totalBill: number }
  >();

  for (const order of delivered) {
    const key = String(order.riderId ?? order.riderName);
    if (!groups.has(key)) {
      groups.set(key, {
        riderId: order.riderId,
        riderName: order.riderName,
        orders: [],
        totalDeliveryCharges: 0,
        totalBill: 0,
      });
    }
    const group = groups.get(key)!;
    group.orders.push(order);
    group.totalDeliveryCharges += Number(order.deliveryCharge);
    group.totalBill += Number(order.totalBill);
  }

  const report = Array.from(groups.values()).sort((a, b) => a.riderName.localeCompare(b.riderName));

  const grandTotals = {
    totalOrders: delivered.length,
    totalDeliveryCharges: delivered.reduce((s, o) => s + Number(o.deliveryCharge), 0),
    totalBill: delivered.reduce((s, o) => s + Number(o.totalBill), 0),
  };

  return Response.json({ date, report, grandTotals });
}
