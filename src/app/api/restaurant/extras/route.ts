import { db } from "@/db";
import { menuExtras } from "@/db/schema";
import { listExtras } from "@/modules/restaurant/restaurant.service";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listExtras());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  if (!name) return Response.json({ error: "Extra name is required" }, { status: 400 });
  if (Number.isNaN(price) || price < 0)
    return Response.json({ error: "Price must be a valid number" }, { status: 400 });

  const [created] = await db.insert(menuExtras).values({ name, price }).returning();
  return Response.json(created, { status: 201 });
}
