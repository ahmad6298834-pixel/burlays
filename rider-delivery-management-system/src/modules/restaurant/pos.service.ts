import { db } from "@/db";
import {
  dealItems as dealItemsTable,
  deals,
  locations,
  menuExtras,
  menuItemSizes,
  menuItems,
  restaurantOrderDealItems,
  restaurantOrderItemExtras,
  restaurantOrderItems,
  orders,
  restaurantOrders,
  riders,
} from "@/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { notifyRiderOfNewOrder } from "@/services/pushNotifications";
import type { RestaurantOrderFull, RestaurantOrderType } from "@/types";

/** Cart line submitted by the POS UI. Prices are re-resolved server-side. */
export type CartLineInput = {
  lineType: "item" | "deal";
  menuItemId?: number | null;
  dealId?: number | null;
  sizeId?: number | null;
  quantity?: number;
  /** Optional add-ons chosen for this line, e.g. extra cheese. */
  extraIds?: number[];
};

export type PricedLine = {
  lineType: "item" | "deal";
  menuItemId: number | null;
  dealId: number | null;
  name: string;
  sizeId: number | null;
  sizeName: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  dealItems: { name: string; sizeName: string | null; quantity: number }[];
  extras: { extraId: number; name: string; price: number }[];
};

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Ensures the atomic counter used for order numbers exists (idempotent). */
async function ensureOrderSequence(): Promise<void> {
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS restaurant_order_seq START 1`);
}

/**
 * Allocates a globally unique order number, e.g. BRL-20260914-0007.
 *
 * The counter comes from a Postgres SEQUENCE (`nextval`), which is atomic and
 * never hands the same value to two callers — even under heavy concurrency. This
 * avoids the read-then-write race a "count today's orders" approach suffers from.
 * The DB's UNIQUE index on order_number remains the final safety net.
 */
export async function allocateOrderNumber(): Promise<string> {
  await ensureOrderSequence();
  const result = await db.execute<{ seq: string }>(sql`SELECT nextval('restaurant_order_seq')::text AS seq`);
  const seq = Number(result.rows[0]?.seq ?? 0);
  return `BRL-${todayISO().replace(/-/g, "")}-${String(seq).padStart(4, "0")}`;
}

/**
 * Preview of the next order number for display in the POS before saving.
 * Uses `last_value + 1` so it does NOT consume a number; the authoritative
 * number is allocated atomically at save time.
 */
export async function generateOrderNumber(): Promise<string> {
  await ensureOrderSequence();
  const result = await db.execute<{ seq: string }>(
    sql`SELECT (CASE WHEN is_called THEN last_value + 1 ELSE last_value END)::text AS seq FROM restaurant_order_seq`
  );
  const seq = Number(result.rows[0]?.seq ?? 1);
  return `BRL-${todayISO().replace(/-/g, "")}-${String(seq).padStart(4, "0")}`;
}

/**
 * Resolves cart lines against the database so prices can never be spoofed or go
 * stale from the client. Pizza-style items must supply a valid size; the size's
 * price is used. Deals use the deal's own fixed price and snapshot their contents.
 */
export async function priceCart(lines: CartLineInput[]): Promise<{ priced: PricedLine[]; error?: string }> {
  const priced: PricedLine[] = [];

  const itemIds = lines.filter((l) => l.lineType === "item" && l.menuItemId).map((l) => Number(l.menuItemId));
  const dealIds = lines.filter((l) => l.lineType === "deal" && l.dealId).map((l) => Number(l.dealId));

  const itemRows = itemIds.length ? await db.select().from(menuItems).where(inArray(menuItems.id, itemIds)) : [];
  const sizeRows = itemIds.length
    ? await db.select().from(menuItemSizes).where(inArray(menuItemSizes.menuItemId, itemIds))
    : [];
  const extraIds = [...new Set(lines.flatMap((l) => (l.extraIds ?? []).map(Number)).filter((n) => !Number.isNaN(n)))];
  const extraRows = extraIds.length
    ? await db.select().from(menuExtras).where(inArray(menuExtras.id, extraIds))
    : [];
  const dealRows = dealIds.length ? await db.select().from(deals).where(inArray(deals.id, dealIds)) : [];
  const dealItemRows = dealIds.length
    ? await db.select().from(dealItemsTable).where(inArray(dealItemsTable.dealId, dealIds))
    : [];

  for (const line of lines) {
    const quantity = Math.max(1, Number(line.quantity) || 1);

    if (line.lineType === "deal") {
      const deal = dealRows.find((d) => d.id === Number(line.dealId));
      if (!deal) return { priced: [], error: "A selected deal no longer exists" };
      const unitPrice = Number(deal.price);
      priced.push({
        lineType: "deal",
        menuItemId: null,
        dealId: deal.id,
        name: deal.name,
        sizeId: null,
        sizeName: null,
        unitPrice,
        quantity,
        lineTotal: unitPrice * quantity,
        dealItems: dealItemRows
          .filter((di) => di.dealId === deal.id)
          .map((di) => ({ name: di.menuItemName, sizeName: di.sizeName, quantity: di.quantity })),
        extras: [],
      });
      continue;
    }

    const item = itemRows.find((i) => i.id === Number(line.menuItemId));
    if (!item) return { priced: [], error: "A selected menu item no longer exists" };

    let unitPrice = Number(item.price);
    let sizeId: number | null = null;
    let sizeName: string | null = null;

    if (item.hasSizes) {
      const size = sizeRows.find((s) => s.id === Number(line.sizeId) && s.menuItemId === item.id);
      if (!size) return { priced: [], error: `Please select a size for "${item.name}"` };
      unitPrice = Number(size.price);
      sizeId = size.id;
      sizeName = size.name;
    }

    // Selected add-ons are priced per unit of the line, then multiplied by quantity.
    const chosenExtras = (line.extraIds ?? [])
      .map((eid) => extraRows.find((e) => e.id === Number(eid)))
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .map((e) => ({ extraId: e.id, name: e.name, price: Number(e.price) }));

    const extrasUnitPrice = chosenExtras.reduce((sum, e) => sum + e.price, 0);

    priced.push({
      lineType: "item",
      menuItemId: item.id,
      dealId: null,
      name: item.name,
      sizeId,
      sizeName,
      unitPrice,
      quantity,
      lineTotal: (unitPrice + extrasUnitPrice) * quantity,
      dealItems: [],
      extras: chosenExtras,
    });
  }

  return { priced };
}

export type CreateOrderInput = {
  orderType: RestaurantOrderType;
  lines: CartLineInput[];
  customerName?: string | null;
  customerPhone?: string | null;
  locationId?: number | null;
  riderId?: number | null;
  customerDeliveryCharge?: number;
  paymentMethod?: string;
};

/**
 * Persists a POS order with server-resolved pricing.
 *
 * Delivery-charge separation:
 *  - customerDeliveryCharge (admin-entered) is added to the customer total.
 *  - riderDeliveryEarning is snapshotted from the location's configured charge
 *    and stored for internal rider earnings only — it is never added to `total`.
 *
 * A rider is only attached if one was explicitly chosen; creating a cart never
 * auto-assigns a rider.
 */
export async function createRestaurantOrder(input: CreateOrderInput) {
  const { priced, error } = await priceCart(input.lines);
  if (error) return { error };
  if (priced.length === 0) return { error: "Cart is empty" };

  const subtotal = priced.reduce((sum, l) => sum + l.lineTotal, 0);
  const isDelivery = input.orderType === "delivery";

  let locationId: number | null = null;
  let locationName: string | null = null;
  let riderDeliveryEarning = 0;
  let customerDeliveryCharge = 0;

  if (isDelivery) {
    if (input.locationId) {
      const [loc] = await db.select().from(locations).where(eq(locations.id, Number(input.locationId))).limit(1);
      if (!loc) return { error: "Delivery location not found" };
      locationId = loc.id;
      locationName = loc.name;
      // Internal rider earning — from location config, never billed to the customer.
      riderDeliveryEarning = Number(loc.deliveryCharge);
    }
    customerDeliveryCharge = Math.max(0, Number(input.customerDeliveryCharge) || 0);
  }

  let riderId: number | null = null;
  let riderName: string | null = null;
  if (isDelivery && input.riderId) {
    const [rider] = await db.select().from(riders).where(eq(riders.id, Number(input.riderId))).limit(1);
    if (!rider) return { error: "Rider not found" };
    riderId = rider.id;
    riderName = rider.name;
  }

  // Only the customer-facing charge is part of what the customer pays.
  const total = subtotal + customerDeliveryCharge;

  const values = {
    orderType: input.orderType,
    customerName: input.customerName?.trim() || null,
    customerPhone: input.customerPhone?.trim() || null,
    locationId,
    locationName,
    riderId,
    riderName,
    subtotal,
    customerDeliveryCharge,
    riderDeliveryEarning,
    total,
    paymentMethod: input.paymentMethod || "Cash",
    orderDate: todayISO(),
    orderTime: nowHHMM(),
  };

  // The sequence guarantees a fresh number per call, so no retry loop is needed.
  const orderNumber = await allocateOrderNumber();
  const [created] = await db.insert(restaurantOrders).values({ ...values, orderNumber }).returning();
  if (!created) return { error: "Could not save the order, please try again" };

  for (const line of priced) {
    const [savedLine] = await db
      .insert(restaurantOrderItems)
      .values({
        restaurantOrderId: created.id,
        lineType: line.lineType,
        menuItemId: line.menuItemId,
        dealId: line.dealId,
        name: line.name,
        sizeId: line.sizeId,
        sizeName: line.sizeName,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
      })
      .returning();

    if (line.extras.length) {
      await db.insert(restaurantOrderItemExtras).values(
        line.extras.map((e) => ({
          orderItemId: savedLine.id,
          extraId: e.extraId,
          name: e.name,
          price: e.price,
        }))
      );
    }

    if (line.dealItems.length) {
      await db.insert(restaurantOrderDealItems).values(
        line.dealItems.map((di) => ({
          orderItemId: savedLine.id,
          name: di.name,
          sizeName: di.sizeName,
          quantity: di.quantity,
        }))
      );
    }
  }

  // ---------------------------------------------------------------------
  // DELIVERY ONLY: bridge into the existing Assign Order / rider workflow by
  // creating a linked row in the delivery-management `orders` table. That table
  // is what the Rider App, rider earnings, ledger and daily reports already read,
  // so every existing behaviour keeps working with no changes to those modules.
  //
  // Dine-in and takeaway deliberately skip this entirely, which is what keeps
  // them out of every rider's My Orders.
  // ---------------------------------------------------------------------
  if (created.orderType === "delivery") {
    const [deliveryOrder] = await db
      .insert(orders)
      .values({
        orderNumber: created.orderNumber,
        riderId: created.riderId,
        // rider_name is NOT NULL; unassigned orders wait in the assignment queue.
        riderName: created.riderName ?? "Unassigned",
        customerName: created.customerName ?? "Walk-in",
        customerPhone: created.customerPhone,
        locationId: created.locationId,
        locationName: created.locationName ?? "",
        // The rider's earning always comes from the location configuration —
        // never from the customer-facing delivery charge.
        deliveryCharge: created.riderDeliveryEarning,
        // What the customer actually pays (food + their delivery charge).
        totalBill: created.total,
        paymentMethod: created.paymentMethod,
        orderDate: created.orderDate,
        orderTime: created.orderTime,
        status: "Assigned",
      })
      .returning();

    await db
      .update(restaurantOrders)
      .set({ deliveryOrderId: deliveryOrder.id })
      .where(eq(restaurantOrders.id, created.id));
    created.deliveryOrderId = deliveryOrder.id;

    // Reuse the existing notification system for the assigned rider.
    if (created.riderId) {
      const [rider] = await db.select().from(riders).where(eq(riders.id, created.riderId)).limit(1);
      if (rider) void notifyRiderOfNewOrder(rider, deliveryOrder);
    }
  }

  return { order: created };
}

/**
 * Re-assigns (or first-assigns) a rider on a restaurant DELIVERY order.
 *
 * Delegates the actual move to the linked delivery order, so the existing rules
 * apply unchanged: earnings follow the order to the new rider, the old rider
 * loses it from their pending list, and the new rider gets the existing
 * "New Order Ready" push. Order history is preserved — nothing is deleted.
 */
export async function assignRiderToRestaurantOrder(restaurantOrderId: number, riderId: number | null) {
  const [ro] = await db.select().from(restaurantOrders).where(eq(restaurantOrders.id, restaurantOrderId)).limit(1);
  if (!ro) return { error: "Order not found" };
  if (ro.orderType !== "delivery") return { error: "Only delivery orders can be assigned to a rider" };
  if (!ro.deliveryOrderId) return { error: "This order is not linked to a delivery record" };

  let rider: typeof riders.$inferSelect | undefined;
  if (riderId) {
    [rider] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
    if (!rider) return { error: "Rider not found" };
  }

  const previousRiderId = ro.riderId;

  await db
    .update(orders)
    .set({ riderId: rider?.id ?? null, riderName: rider?.name ?? "Unassigned" })
    .where(eq(orders.id, ro.deliveryOrderId));

  const [updated] = await db
    .update(restaurantOrders)
    .set({ riderId: rider?.id ?? null, riderName: rider?.name ?? null })
    .where(eq(restaurantOrders.id, restaurantOrderId))
    .returning();

  // Notify only when the order actually moved to a different rider.
  if (rider && rider.id !== previousRiderId) {
    const [deliveryOrder] = await db.select().from(orders).where(eq(orders.id, ro.deliveryOrderId)).limit(1);
    if (deliveryOrder && deliveryOrder.status === "Assigned") {
      void notifyRiderOfNewOrder(rider, deliveryOrder);
    }
  }

  return { order: updated };
}

/** Full order with its lines and any deal contents, for receipts/kitchen tickets. */
export async function getRestaurantOrder(id: number): Promise<RestaurantOrderFull | null> {
  const [order] = await db.select().from(restaurantOrders).where(eq(restaurantOrders.id, id)).limit(1);
  if (!order) return null;

  const lines = await db
    .select()
    .from(restaurantOrderItems)
    .where(eq(restaurantOrderItems.restaurantOrderId, id));

  const dealLines = lines.length
    ? await db
        .select()
        .from(restaurantOrderDealItems)
        .where(
          inArray(
            restaurantOrderDealItems.orderItemId,
            lines.map((l) => l.id)
          )
        )
    : [];

  const extraLines = lines.length
    ? await db
        .select()
        .from(restaurantOrderItemExtras)
        .where(
          inArray(
            restaurantOrderItemExtras.orderItemId,
            lines.map((l) => l.id)
          )
        )
    : [];

  // Pull the live status/rider from the linked delivery order so the admin always
  // sees the current state (e.g. once the rider marks it Delivered in the app).
  let deliveryStatus: string | null = null;
  if (order.deliveryOrderId) {
    const [d] = await db.select().from(orders).where(eq(orders.id, order.deliveryOrderId)).limit(1);
    if (d) deliveryStatus = d.status;
  }

  return {
    ...order,
    deliveryStatus,
    items: lines.map((l) => ({
      ...l,
      dealItems: dealLines.filter((d) => d.orderItemId === l.id),
      extras: extraLines.filter((e) => e.orderItemId === l.id),
    })),
  };
}

/** Recent POS orders, each with the live status of its linked delivery order (if any). */
export async function listRestaurantOrders(limit = 50) {
  const rows = await db.select().from(restaurantOrders).orderBy(desc(restaurantOrders.createdAt)).limit(limit);
  const deliveryIds = rows.map((r) => r.deliveryOrderId).filter((id): id is number => Boolean(id));
  const deliveryRows = deliveryIds.length
    ? await db.select().from(orders).where(inArray(orders.id, deliveryIds))
    : [];

  return rows.map((r) => ({
    ...r,
    deliveryStatus: deliveryRows.find((d) => d.id === r.deliveryOrderId)?.status ?? null,
  }));
}
