import { db } from "@/db";
import {
  orders,
  restaurantOrderItemExtras,
  restaurantOrderItems,
  restaurantOrders,
} from "@/db/schema";
import { and, asc, eq, gte, inArray, isNull, lte, SQL } from "drizzle-orm";

export type ReportFilters = {
  from: string;
  to: string;
  orderType?: string | null;
  paymentMethod?: string | null;
  riderId?: number | null;
  locationId?: number | null;
};

/** Resolves a named preset (today / yesterday / week / month) to a date range. */
export function resolveRange(preset: string | null, from?: string | null, to?: string | null) {
  const now = new Date();
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = iso(now);

  switch (preset) {
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: iso(y), to: iso(y) };
    }
    case "week": {
      // Week starts Monday.
      const d = new Date(now);
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      return { from: iso(d), to: today };
    }
    case "month": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: iso(d), to: today };
    }
    case "custom":
      return { from: from || today, to: to || today };
    case "today":
    default:
      return { from: today, to: today };
  }
}

/**
 * Builds the full restaurant report for a date range.
 *
 * Important accounting rule enforced here: the rider delivery earning always
 * comes from `riderDeliveryEarning` (snapshotted from the location's configured
 * charge) and is NEVER derived from `customerDeliveryCharge`, which is what the
 * customer was billed. The two are reported as separate figures throughout.
 */
export async function buildRestaurantReport(filters: ReportFilters) {
  const conditions: SQL[] = [
    isNull(restaurantOrders.deletedAt),
    gte(restaurantOrders.orderDate, filters.from),
    lte(restaurantOrders.orderDate, filters.to),
  ];
  if (filters.orderType) conditions.push(eq(restaurantOrders.orderType, filters.orderType));
  if (filters.paymentMethod) conditions.push(eq(restaurantOrders.paymentMethod, filters.paymentMethod));
  if (filters.riderId) conditions.push(eq(restaurantOrders.riderId, filters.riderId));
  if (filters.locationId) conditions.push(eq(restaurantOrders.locationId, filters.locationId));

  const orderRows = await db
    .select()
    .from(restaurantOrders)
    .where(and(...conditions))
    .orderBy(asc(restaurantOrders.orderDate), asc(restaurantOrders.orderTime));

  const ids = orderRows.map((o) => o.id);
  const lines = ids.length
    ? await db.select().from(restaurantOrderItems).where(inArray(restaurantOrderItems.restaurantOrderId, ids))
    : [];
  const lineIds = lines.map((l) => l.id);
  const extras = lineIds.length
    ? await db.select().from(restaurantOrderItemExtras).where(inArray(restaurantOrderItemExtras.orderItemId, lineIds))
    : [];

  // Live delivery status for the linked delivery orders (delivery sales only).
  const deliveryIds = orderRows.map((o) => o.deliveryOrderId).filter((id): id is number => Boolean(id));
  const deliveryRows = deliveryIds.length
    ? await db.select().from(orders).where(inArray(orders.id, deliveryIds))
    : [];

  const num = (v: unknown) => Number(v ?? 0);

  // ---------- Per-order detail rows ----------
  const detail = orderRows.map((o) => {
    const myLines = lines.filter((l) => l.restaurantOrderId === o.id);
    const linked = deliveryRows.find((d) => d.id === o.deliveryOrderId);
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      orderType: o.orderType,
      orderDate: o.orderDate,
      orderTime: o.orderTime,
      items: myLines.map((l) => ({
        name: l.name,
        sizeName: l.sizeName,
        quantity: l.quantity,
        lineTotal: num(l.lineTotal),
        extras: extras.filter((e) => e.orderItemId === l.id).map((e) => e.name),
      })),
      totalQuantity: myLines.reduce((s, l) => s + l.quantity, 0),
      foodTotal: num(o.subtotal),
      customerDeliveryCharge: num(o.customerDeliveryCharge),
      grandTotal: num(o.total),
      paymentMethod: o.paymentMethod,
      // Dine-in and takeaway have no rider by definition.
      riderName: o.orderType === "delivery" ? o.riderName ?? "Unassigned" : null,
      riderDeliveryEarning: num(o.riderDeliveryEarning),
      deliveryStatus: linked?.status ?? null,
    };
  });

  // ---------- Sales summary, split by order type ----------
  const byType = (t: string) => detail.filter((d) => d.orderType === t);
  const sum = (rows: typeof detail, key: "foodTotal" | "customerDeliveryCharge" | "grandTotal") =>
    rows.reduce((s, r) => s + r[key], 0);

  const typeSummary = ["dine-in", "takeaway", "delivery"].map((t) => {
    const rows = byType(t);
    return {
      orderType: t,
      orders: rows.length,
      foodTotal: sum(rows, "foodTotal"),
      customerDeliveryCharge: sum(rows, "customerDeliveryCharge"),
      grandTotal: sum(rows, "grandTotal"),
    };
  });

  // ---------- Daily sales trend ----------
  const dayMap = new Map<string, { date: string; orders: number; foodTotal: number; customerDeliveryCharge: number; grandTotal: number }>();
  for (const d of detail) {
    const row = dayMap.get(d.orderDate) ?? {
      date: d.orderDate,
      orders: 0,
      foodTotal: 0,
      customerDeliveryCharge: 0,
      grandTotal: 0,
    };
    row.orders += 1;
    row.foodTotal += d.foodTotal;
    row.customerDeliveryCharge += d.customerDeliveryCharge;
    row.grandTotal += d.grandTotal;
    dayMap.set(d.orderDate, row);
  }
  const dailySales = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // ---------- Menu item sales (item lines only) ----------
  const itemMap = new Map<string, { name: string; quantity: number; total: number }>();
  for (const l of lines.filter((x) => x.lineType === "item")) {
    if (!ids.includes(l.restaurantOrderId)) continue;
    const key = l.sizeName ? `${l.name} (${l.sizeName})` : l.name;
    const row = itemMap.get(key) ?? { name: key, quantity: 0, total: 0 };
    row.quantity += l.quantity;
    row.total += num(l.lineTotal);
    itemMap.set(key, row);
  }
  const menuItemSales = [...itemMap.values()].sort((a, b) => b.total - a.total);

  // ---------- Deal sales (deal lines only) ----------
  const dealMap = new Map<string, { name: string; quantity: number; total: number }>();
  for (const l of lines.filter((x) => x.lineType === "deal")) {
    const row = dealMap.get(l.name) ?? { name: l.name, quantity: 0, total: 0 };
    row.quantity += l.quantity;
    row.total += num(l.lineTotal);
    dealMap.set(l.name, row);
  }
  const dealSales = [...dealMap.values()].sort((a, b) => b.total - a.total);

  // ---------- Payment method summary ----------
  const payMap = new Map<string, { paymentMethod: string; orders: number; total: number }>();
  for (const d of detail) {
    const row = payMap.get(d.paymentMethod) ?? { paymentMethod: d.paymentMethod, orders: 0, total: 0 };
    row.orders += 1;
    row.total += d.grandTotal;
    payMap.set(d.paymentMethod, row);
  }
  const paymentSummary = [...payMap.values()].sort((a, b) => b.total - a.total);

  // ---------- Rider delivery earnings ----------
  // Counted only for delivery orders whose linked delivery record is Delivered,
  // matching how rider earnings/ledger are calculated elsewhere in the system.
  const riderMap = new Map<string, { riderName: string; deliveries: number; earnings: number; customerCharges: number }>();
  for (const d of detail) {
    if (d.orderType !== "delivery" || d.deliveryStatus !== "Delivered") continue;
    const key = d.riderName ?? "Unassigned";
    const row = riderMap.get(key) ?? { riderName: key, deliveries: 0, earnings: 0, customerCharges: 0 };
    row.deliveries += 1;
    row.earnings += d.riderDeliveryEarning;
    row.customerCharges += d.customerDeliveryCharge;
    riderMap.set(key, row);
  }
  const riderEarnings = [...riderMap.values()].sort((a, b) => b.earnings - a.earnings);

  return {
    range: { from: filters.from, to: filters.to },
    totals: {
      orders: detail.length,
      foodSales: sum(detail, "foodTotal"),
      /** Billed to customers. */
      customerDeliveryCharges: sum(detail, "customerDeliveryCharge"),
      totalSales: sum(detail, "grandTotal"),
      /** Paid to riders — from location config, never from the customer charge. */
      riderDeliveryEarnings: riderEarnings.reduce((s, r) => s + r.earnings, 0),
    },
    typeSummary,
    dailySales,
    menuItemSales,
    dealSales,
    paymentSummary,
    riderEarnings,
    detail,
  };
}
