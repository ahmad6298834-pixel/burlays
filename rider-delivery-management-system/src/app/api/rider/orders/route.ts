import { db } from "@/db";
import { orders } from "@/db/schema";
import { authenticateRider } from "@/modules/authentication/auth.service";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rider = await authenticateRider(request);
  if (!rider) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const conditions = [eq(orders.riderId, rider.id)];
  if (status) conditions.push(eq(orders.status, status));

  const list = await db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.orderDate), desc(orders.orderTime), desc(orders.createdAt));

  return Response.json(list);
}
