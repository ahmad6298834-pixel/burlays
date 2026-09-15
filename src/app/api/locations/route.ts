import { db } from "@/db";
import { locations } from "@/db/schema";
import { asc } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const list = await db.select().from(locations).orderBy(asc(locations.name));
  return Response.json(list);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const deliveryCharge = Number(body.deliveryCharge);

  if (!name) {
    return Response.json({ error: "Location name is required" }, { status: 400 });
  }
  if (Number.isNaN(deliveryCharge) || deliveryCharge < 0) {
    return Response.json({ error: "Delivery charge must be a valid number" }, { status: 400 });
  }

  const [created] = await db.insert(locations).values({ name, deliveryCharge }).returning();
  return Response.json(created, { status: 201 });
}
