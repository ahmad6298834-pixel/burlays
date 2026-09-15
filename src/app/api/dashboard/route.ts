import { db } from "@/db";
import { locations, orders, riders, restaurantOrders } from "@/db/schema";
import { getRiderFinancialsMap } from "@/modules/riders/riderFinancials.service";
import { and, eq, isNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function todayServerISO() {
  const now = new Date();
  const tz = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

export async function GET() {
  const today = todayServerISO();

  const [riderCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${riders.active} = true)::int`,
    })
    .from(riders);

  const [locationCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${locations.active} = true)::int`,
    })
    .from(locations);

  const [todayStats] = await db
    .select({
      deliveredOrders: sql<number>`count(*)::int`,
      deliveryCharges: sql<number>`coalesce(sum(${orders.deliveryCharge}), 0)::float`,
      totalBill: sql<number>`coalesce(sum(${orders.totalBill}), 0)::float`,
    })
    .from(orders)
    .where(and(eq(orders.orderDate, today), eq(orders.status, "Delivered")));

  const [todayAllOrders] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.orderDate, today));

  // ---------------- RESTAURANT (Burlays POS) ----------------
  // Food sales and customer delivery charges are summed separately and never
  // mixed with the rider delivery earning, which is a different concept.
  const [restaurantToday] = await db
    .select({
      dineIn: sql<number>`count(*) filter (where ${restaurantOrders.orderType} = 'dine-in')::int`,
      takeaway: sql<number>`count(*) filter (where ${restaurantOrders.orderType} = 'takeaway')::int`,
      delivery: sql<number>`count(*) filter (where ${restaurantOrders.orderType} = 'delivery')::int`,
      totalOrders: sql<number>`count(*)::int`,
      foodSales: sql<number>`coalesce(sum(${restaurantOrders.subtotal}), 0)::float`,
      customerDeliveryCharges: sql<number>`coalesce(sum(${restaurantOrders.customerDeliveryCharge}), 0)::float`,
      totalSales: sql<number>`coalesce(sum(${restaurantOrders.total}), 0)::float`,
    })
    .from(restaurantOrders)
    .where(and(eq(restaurantOrders.orderDate, today), isNull(restaurantOrders.deletedAt)));

  // ---------------- DELIVERY (rider workflow) ----------------
  const [deliveryToday] = await db
    .select({
      assigned: sql<number>`count(*) filter (where ${orders.status} = 'Assigned')::int`,
      delivered: sql<number>`count(*) filter (where ${orders.status} = 'Delivered')::int`,
      // Rider earning comes from the location-configured charge on delivered orders.
      riderEarnings: sql<number>`coalesce(sum(${orders.deliveryCharge}) filter (where ${orders.status} = 'Delivered'), 0)::float`,
    })
    .from(orders)
    .where(eq(orders.orderDate, today));

  // Pending deliveries are counted across all dates, not just today, so nothing
  // sitting unfinished from a previous day is missed.
  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.status, "Assigned"));

  const financialsMap = await getRiderFinancialsMap();
  const allRiders = await db.select().from(riders);

  let totalOutstandingAdvances = 0;
  const ridersWithOutstanding: {
    id: number;
    name: string;
    balance: number;
  }[] = [];

  for (const rider of allRiders) {
    const fin = financialsMap.get(rider.id);
    if (!fin) continue;
    if (fin.balance < 0) totalOutstandingAdvances += Math.abs(fin.balance);
    if (fin.balance !== 0) {
      ridersWithOutstanding.push({ id: rider.id, name: rider.name, balance: fin.balance });
    }
  }

  ridersWithOutstanding.sort((a, b) => a.balance - b.balance);

  return Response.json({
    totalRiders: riderCounts?.total ?? 0,
    activeRiders: riderCounts?.active ?? 0,
    totalLocations: locationCounts?.total ?? 0,
    activeLocations: locationCounts?.active ?? 0,
    todayDeliveredOrders: todayStats?.deliveredOrders ?? 0,
    todayTotalOrders: todayAllOrders?.count ?? 0,
    todayDeliveryCharges: todayStats?.deliveryCharges ?? 0,
    todayTotalBill: todayStats?.totalBill ?? 0,
    totalOutstandingAdvances,
    ridersWithOutstanding,

    // --- Restaurant (Burlays) ---
    todayDineInOrders: restaurantToday?.dineIn ?? 0,
    todayTakeawayOrders: restaurantToday?.takeaway ?? 0,
    todayRestaurantDeliveryOrders: restaurantToday?.delivery ?? 0,
    todayRestaurantOrders: restaurantToday?.totalOrders ?? 0,
    todayFoodSales: restaurantToday?.foodSales ?? 0,
    /** Charged to customers — distinct from rider earnings below. */
    todayCustomerDeliveryCharges: restaurantToday?.customerDeliveryCharges ?? 0,
    todayTotalSales: restaurantToday?.totalSales ?? 0,

    // --- Delivery workflow ---
    todayAssignedDeliveries: deliveryToday?.assigned ?? 0,
    /** Paid to riders — distinct from customer delivery charges above. */
    todayRiderDeliveryEarnings: deliveryToday?.riderEarnings ?? 0,
    pendingDeliveries: pending?.count ?? 0,

    date: today,
  });
}
