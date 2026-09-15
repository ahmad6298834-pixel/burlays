import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import { asc } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Seeds sensible defaults once, so a fresh install still has usable options. */
async function ensureDefaults() {
  const existing = await db.select().from(paymentMethods).limit(1);
  if (existing.length > 0) return;
  await db.insert(paymentMethods).values([
    { name: "Cash", sortOrder: 0 },
    { name: "Card", sortOrder: 1 },
    { name: "Online", sortOrder: 2 },
  ]);
}

export async function GET() {
  await ensureDefaults();
  const list = await db.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name));
  return Response.json(list);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) return Response.json({ error: "Payment method name is required" }, { status: 400 });

  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  const [created] = await db.insert(paymentMethods).values({ name, sortOrder }).returning();
  return Response.json(created, { status: 201 });
}
