import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { menuItemDealCount, replaceItemSizes } from "@/modules/restaurant/restaurant.service";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
type SizeInput = { name?: unknown; price?: unknown };

function parseSizes(raw: unknown): { name: string; price: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: SizeInput) => ({ name: String(s?.name ?? "").trim(), price: Number(s?.price) || 0 }))
    .filter((s) => s.name.length > 0);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const itemId = Number(id);
  if (Number.isNaN(itemId)) return Response.json({ error: "Invalid item id" }, { status: 400 });

  const body = await request.json();
  const updates: Partial<typeof menuItems.$inferInsert> = { updatedAt: new Date() };

  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  // Empty string clears the picture (Remove image).
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl ? String(body.imageUrl) : null;
  if (typeof body.active === "boolean") updates.active = body.active;
  if (body.categoryId !== undefined) {
    const categoryId = body.categoryId === null || body.categoryId === "" ? null : Number(body.categoryId);
    updates.categoryId = categoryId !== null && !Number.isNaN(categoryId) ? categoryId : null;
  }

  const hasSizes = body.hasSizes !== undefined ? Boolean(body.hasSizes) : undefined;
  if (hasSizes !== undefined) updates.hasSizes = hasSizes;

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (Number.isNaN(price) || price < 0)
      return Response.json({ error: "Price must be a valid number" }, { status: 400 });
    updates.price = price;
  }

  const [updated] = await db.update(menuItems).set(updates).where(eq(menuItems.id, itemId)).returning();
  if (!updated) return Response.json({ error: "Menu item not found" }, { status: 404 });

  // Sizes are replaced wholesale when supplied; switching an item off sizes clears them.
  if (body.sizes !== undefined && updated.hasSizes) {
    const sizes = parseSizes(body.sizes);
    if (sizes.length === 0)
      return Response.json({ error: "Add at least one size (e.g. Small) with a price" }, { status: 400 });
    await replaceItemSizes(itemId, sizes);
  } else if (hasSizes === false) {
    await replaceItemSizes(itemId, []);
  }

  return Response.json(updated);
}

/**
 * Hard delete is blocked while the item is part of a deal, because removing it
 * would change what that deal contains. The admin is told to deactivate instead
 * (soft delete), which hides it from the menu while preserving all references.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const itemId = Number(id);
  if (Number.isNaN(itemId)) return Response.json({ error: "Invalid item id" }, { status: 400 });

  const inDeals = await menuItemDealCount(itemId);
  if (inDeals > 0) {
    return Response.json(
      { error: `This item is used in ${inDeals} deal(s). Deactivate it instead, or remove it from those deals first.` },
      { status: 409 }
    );
  }

  await db.delete(menuItems).where(eq(menuItems.id, itemId));
  return Response.json({ ok: true });
}
