import { db } from "@/db";
import { orders, riderTransactions, riders } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export type RiderFinancials = {
  riderId: number;
  deliveredCount: number;
  earnings: number;
  advances: number;
  payments: number;
  adjustments: number;
  balance: number;
};

function emptyFinancials(riderId: number): RiderFinancials {
  return { riderId, deliveredCount: 0, earnings: 0, advances: 0, payments: 0, adjustments: 0, balance: 0 };
}

/** Returns a map of riderId -> financial summary for all riders (or a single rider if riderId provided). */
export async function getRiderFinancialsMap(riderId?: number): Promise<Map<number, RiderFinancials>> {
  const earningsRows = await db
    .select({
      riderId: orders.riderId,
      earnings: sql<number>`coalesce(sum(${orders.deliveryCharge}), 0)::float`,
      deliveredCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      riderId
        ? and(eq(orders.status, "Delivered"), eq(orders.riderId, riderId))
        : eq(orders.status, "Delivered")
    )
    .groupBy(orders.riderId);

  const txRows = await db
    .select({
      riderId: riderTransactions.riderId,
      type: riderTransactions.type,
      total: sql<number>`coalesce(sum(${riderTransactions.amount}), 0)::float`,
    })
    .from(riderTransactions)
    .where(riderId ? eq(riderTransactions.riderId, riderId) : undefined)
    .groupBy(riderTransactions.riderId, riderTransactions.type);

  const map = new Map<number, RiderFinancials>();

  for (const row of earningsRows) {
    if (row.riderId === null) continue;
    const entry = map.get(row.riderId) ?? emptyFinancials(row.riderId);
    entry.earnings = Number(row.earnings);
    entry.deliveredCount = Number(row.deliveredCount);
    map.set(row.riderId, entry);
  }

  for (const row of txRows) {
    const entry = map.get(row.riderId) ?? emptyFinancials(row.riderId);
    const amount = Number(row.total);
    if (row.type === "advance") entry.advances = amount;
    else if (row.type === "payment") entry.payments = amount;
    else if (row.type === "adjustment") entry.adjustments = amount;
    map.set(row.riderId, entry);
  }

  for (const entry of map.values()) {
    entry.balance = entry.earnings - entry.advances - entry.payments + entry.adjustments;
  }

  return map;
}

export type LedgerRow = {
  id: string;
  date: string;
  sortKey: string;
  description: string;
  deliveryEarnings: number;
  advanceTaken: number;
  adjustment: number;
  runningBalance: number;
};

export async function getRiderLedger(riderId: number) {
  const [rider] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
  if (!rider) return null;

  const deliveredOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.riderId, riderId), eq(orders.status, "Delivered")));

  const transactions = await db
    .select()
    .from(riderTransactions)
    .where(eq(riderTransactions.riderId, riderId));

  type RawRow = {
    date: string;
    sortKey: string;
    description: string;
    deliveryEarnings: number;
    advanceTaken: number;
    adjustment: number;
  };

  const rawRows: RawRow[] = [];

  for (const order of deliveredOrders) {
    rawRows.push({
      date: order.orderDate,
      sortKey: `${order.orderDate}T${order.orderTime}Z${order.id}`,
      description: `Delivery earning - ${order.customerName} (${order.orderNumber}) - ${order.locationName}`,
      deliveryEarnings: Number(order.deliveryCharge),
      advanceTaken: 0,
      adjustment: 0,
    });
  }

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    if (tx.type === "advance") {
      rawRows.push({
        date: tx.date,
        sortKey: `${tx.date}T00:00Y${tx.id}`,
        description: tx.note ? `Advance taken - ${tx.note}` : "Advance taken",
        deliveryEarnings: 0,
        advanceTaken: amount,
        adjustment: 0,
      });
    } else if (tx.type === "payment") {
      rawRows.push({
        date: tx.date,
        sortKey: `${tx.date}T00:00Y${tx.id}`,
        description: tx.note ? `Payment made - ${tx.note}` : "Payment made to rider",
        deliveryEarnings: 0,
        advanceTaken: 0,
        adjustment: -amount,
      });
    } else {
      rawRows.push({
        date: tx.date,
        sortKey: `${tx.date}T00:00Y${tx.id}`,
        description: tx.note ? `Adjustment - ${tx.note}` : "Manual adjustment",
        deliveryEarnings: 0,
        advanceTaken: 0,
        adjustment: amount,
      });
    }
  }

  rawRows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let running = 0;
  const ledger: LedgerRow[] = rawRows.map((row, index) => {
    running += row.deliveryEarnings - row.advanceTaken + row.adjustment;
    return { id: `${index}`, runningBalance: running, ...row };
  });

  const totals = {
    earnings: rawRows.reduce((s, r) => s + r.deliveryEarnings, 0),
    advances: rawRows.reduce((s, r) => s + r.advanceTaken, 0),
    adjustments: rawRows.reduce((s, r) => s + r.adjustment, 0),
    balance: running,
    deliveredCount: deliveredOrders.length,
  };

  return { rider, ledger: ledger.reverse(), totals };
}
