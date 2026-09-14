import { db } from "@/db";
import { orders } from "@/db/schema";
import { authenticateRider } from "@/modules/authentication/auth.service";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function todayServerISO() {
  const now = new Date();
  const tz = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const rider = await authenticateRider(request);
  if (!rider) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayServerISO();

  const [counts] = await db
    .select({
      totalAssigned: sql<number>`count(*) filter (where ${orders.status} = 'Assigned')::int`,
      totalDelivered: sql<number>`count(*) filter (where ${orders.status} = 'Delivered')::int`,
      totalCancelled: sql<number>`count(*) filter (where ${orders.status} = 'Cancelled')::int`,
      totalOrders: sql<number>`count(*)::int`,
      todayAssigned: sql<number>`count(*) filter (where ${orders.orderDate} = ${today} and ${orders.status} = 'Assigned')::int`,
      todayDelivered: sql<number>`count(*) filter (where ${orders.orderDate} = ${today} and ${orders.status} = 'Delivered')::int`,
      todayEarnings: sql<number>`coalesce(sum(${orders.deliveryCharge}) filter (where ${orders.orderDate} = ${today} and ${orders.status} = 'Delivered'), 0)::float`,
      totalEarnings: sql<number>`coalesce(sum(${orders.deliveryCharge}) filter (where ${orders.status} = 'Delivered'), 0)::float`,
    })
    .from(orders)
    .where(eq(orders.riderId, rider.id));

  return Response.json({
    riderName: rider.name,
    totalAssignedOrders: counts?.totalAssigned ?? 0,
    totalDeliveredOrders: counts?.totalDelivered ?? 0,
    totalPendingOrders: counts?.totalAssigned ?? 0,
    totalCancelledOrders: counts?.totalCancelled ?? 0,
    totalOrders: counts?.totalOrders ?? 0,
    todayAssignedOrders: counts?.todayAssigned ?? 0,
    todayDeliveredOrders: counts?.todayDelivered ?? 0,
    todayDeliveryEarnings: counts?.todayEarnings ?? 0,
    totalDeliveryEarnings: counts?.totalEarnings ?? 0,
    date: today,
  });
}
