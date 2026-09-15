import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { listMenuItems, replaceItemSizes } from "@/modules/restaurant/restaurant.service";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listMenuItems());
}

type SizeInput = { name?: unknown; price?: unknown };

/** Normalizes the optional sizes array (only used for sized items such as Pizza). */
function parseSizes(raw: unknown): { name: string; price: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: SizeInput) => ({ name: String(s?.name ?? "").trim(), price: Number(s?.price) || 0 }))
    .filter((s) => s.name.length > 0);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) return Response.json({ error: "Item name is required" }, { status: 400 });

  const hasSizes = Boolean(body.hasSizes);
  const sizes = parseSizes(body.sizes);
  if (hasSizes && sizes.length === 0)
    return Response.json({ error: "Add at least one size (e.g. Small) with a price" }, { status: 400 });

  // Items without sizes carry their own price; sized items price via their sizes.
  const price = hasSizes ? 0 : Number(body.price);
  if (!hasSizes && (Number.isNaN(price) || price < 0))
    return Response.json({ error: "Price must be a valid number" }, { status: 400 });

  const categoryId =
    body.categoryId !== undefined && body.categoryId !== null && body.categoryId !== ""
      ? Number(body.categoryId)
      : null;

  const [created] = await db
    .insert(menuItems)
    .values({
      name,
      categoryId: categoryId && !Number.isNaN(categoryId) ? categoryId : null,
      description: body.description ? String(body.description).trim() : null,
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
      price,
      hasSizes,
    })
    .returning();

  if (hasSizes) await replaceItemSizes(created.id, sizes);

  return Response.json(created, { status: 201 });
}
