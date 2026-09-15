import { db } from "@/db";
import { riderTransactions, riders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["advance", "payment", "adjustment"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const riderId = searchParams.get("riderId");

  const list = await db
    .select({
      id: riderTransactions.id,
      riderId: riderTransactions.riderId,
      riderName: riders.name,
      type: riderTransactions.type,
      amount: riderTransactions.amount,
      date: riderTransactions.date,
      note: riderTransactions.note,
      createdAt: riderTransactions.createdAt,
    })
    .from(riderTransactions)
    .leftJoin(riders, eq(riders.id, riderTransactions.riderId))
    .where(riderId ? eq(riderTransactions.riderId, Number(riderId)) : undefined)
    .orderBy(desc(riderTransactions.date), desc(riderTransactions.createdAt));

  return Response.json(list);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const riderId = Number(body.riderId);
  const type = String(body.type ?? "");
  const rawAmount = Number(body.amount);
  const date = String(body.date ?? "").trim();
  const note = body.note ? String(body.note).trim() : null;

  if (!riderId || Number.isNaN(riderId)) {
    return Response.json({ error: "Rider is required" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return Response.json({ error: "Invalid transaction type" }, { status: 400 });
  }
  if (Number.isNaN(rawAmount) || rawAmount === 0) {
    return Response.json({ error: "Amount must be a non-zero number" }, { status: 400 });
  }
  if (!date) {
    return Response.json({ error: "Date is required" }, { status: 400 });
  }

  const [rider] = await db.select().from(riders).where(eq(riders.id, riderId)).limit(1);
  if (!rider) {
    return Response.json({ error: "Rider not found" }, { status: 404 });
  }

  // Advances and payments are always stored as positive amounts (they subtract from balance).
  const amount = type === "adjustment" ? rawAmount : Math.abs(rawAmount);

  const [created] = await db
    .insert(riderTransactions)
    .values({ riderId, type, amount, date, note })
    .returning();

  return Response.json(created, { status: 201 });
}
