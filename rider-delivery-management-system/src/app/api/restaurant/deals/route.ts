import { db } from "@/db";
import { deals } from "@/db/schema";
import { listDeals, replaceDealItems } from "@/modules/restaurant/restaurant.service";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listDeals());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);

  if (!name) return Response.json({ error: "Deal name is required" }, { status: 400 });
  if (Number.isNaN(price) || price < 0)
    return Response.json({ error: "Deal price must be a valid number" }, { status: 400 });

  const [created] = await db
    .insert(deals)
    .values({
      name,
      // The deal's fixed price is stored independently of its items' own prices.
      price,
      description: body.description ? String(body.description).trim() : null,
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
    })
    .returning();

  if (Array.isArray(body.items)) await replaceDealItems(created.id, body.items);

  return Response.json(created, { status: 201 });
}
