import { db } from "@/db";
import { menuCategories } from "@/db/schema";
import { categoryItemCount } from "@/modules/restaurant/restaurant.service";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const categoryId = Number(id);
  if (Number.isNaN(categoryId)) return Response.json({ error: "Invalid category id" }, { status: 400 });

  const body = await request.json();
  const updates: Partial<typeof menuCategories.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.active === "boolean") updates.active = body.active;
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder)))
    updates.sortOrder = Number(body.sortOrder);

  const [updated] = await db
    .update(menuCategories)
    .set(updates)
    .where(eq(menuCategories.id, categoryId))
    .returning();
  if (!updated) return Response.json({ error: "Category not found" }, { status: 404 });
  return Response.json(updated);
}

/**
 * Hard delete is only allowed for an empty category. If menu items still belong to
 * it, we refuse and point the admin at deactivation (soft delete) instead, so no
 * product silently loses its category.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const categoryId = Number(id);
  if (Number.isNaN(categoryId)) return Response.json({ error: "Invalid category id" }, { status: 400 });

  const inUse = await categoryItemCount(categoryId);
  if (inUse > 0) {
    return Response.json(
      {
        error: `This category still has ${inUse} menu item(s). Deactivate it instead, or move those items to another category first.`,
      },
      { status: 409 }
    );
  }

  await db.delete(menuCategories).where(eq(menuCategories.id, categoryId));
  return Response.json({ ok: true });
}
