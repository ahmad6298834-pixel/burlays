import { db } from "@/db";
import { dealItems, deals, menuCategories, menuExtras, menuItemSizes, menuItems } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import type { DealWithItems, MenuItemWithSizes } from "@/types";

/**
 * Data access for the Burlays restaurant menu.
 *
 * Soft-delete policy: every entity has an `active` flag which is the preferred
 * way to retire a product, because deactivating keeps the row (and therefore any
 * historical reference to it) intact. Hard delete is only permitted when the row
 * is not referenced anywhere that would lose meaning — the guards below enforce
 * that and tell the admin to deactivate instead.
 */

/** Categories ordered for display. */
export async function listCategories() {
  return db.select().from(menuCategories).orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
}

/** Menu items with their category name and any per-size prices attached. */
export async function listMenuItems(): Promise<MenuItemWithSizes[]> {
  const rows = await db
    .select({ item: menuItems, categoryName: menuCategories.name })
    .from(menuItems)
    .leftJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
    .orderBy(asc(menuItems.name));

  if (rows.length === 0) return [];

  const sizes = await db
    .select()
    .from(menuItemSizes)
    .where(
      inArray(
        menuItemSizes.menuItemId,
        rows.map((r) => r.item.id)
      )
    )
    .orderBy(asc(menuItemSizes.sortOrder), asc(menuItemSizes.id));

  return rows.map(({ item, categoryName }) => ({
    ...item,
    categoryName,
    sizes: sizes.filter((s) => s.menuItemId === item.id),
  }));
}

/** Replaces the size rows for an item (used on create/update of a sized item). */
export async function replaceItemSizes(
  menuItemId: number,
  sizes: { name: string; price: number }[]
): Promise<void> {
  await db.delete(menuItemSizes).where(eq(menuItemSizes.menuItemId, menuItemId));
  if (sizes.length === 0) return;
  await db.insert(menuItemSizes).values(
    sizes.map((s, index) => ({
      menuItemId,
      name: s.name.trim(),
      price: Number(s.price) || 0,
      sortOrder: index,
    }))
  );
}

/** Deals with their line items attached. */
export async function listDeals(): Promise<DealWithItems[]> {
  const dealRows = await db.select().from(deals).orderBy(asc(deals.name));
  if (dealRows.length === 0) return [];

  const items = await db
    .select()
    .from(dealItems)
    .where(
      inArray(
        dealItems.dealId,
        dealRows.map((d) => d.id)
      )
    )
    .orderBy(asc(dealItems.id));

  return dealRows.map((deal) => ({ ...deal, items: items.filter((i) => i.dealId === deal.id) }));
}

/**
 * Replaces a deal's line items. Item/size names are snapshotted so the deal stays
 * readable even if the underlying menu item is later renamed or deactivated.
 */
export async function replaceDealItems(
  dealId: number,
  lines: { menuItemId: number; sizeId?: number | null; quantity?: number }[]
): Promise<void> {
  await db.delete(dealItems).where(eq(dealItems.dealId, dealId));
  if (lines.length === 0) return;

  const itemIds = lines.map((l) => Number(l.menuItemId)).filter((n) => !Number.isNaN(n));
  const itemRows = itemIds.length ? await db.select().from(menuItems).where(inArray(menuItems.id, itemIds)) : [];
  const sizeIds = lines.map((l) => Number(l.sizeId)).filter((n) => n && !Number.isNaN(n));
  const sizeRows = sizeIds.length
    ? await db.select().from(menuItemSizes).where(inArray(menuItemSizes.id, sizeIds))
    : [];

  const values = lines
    .map((line) => {
      const item = itemRows.find((i) => i.id === Number(line.menuItemId));
      if (!item) return null;
      const size = line.sizeId ? sizeRows.find((s) => s.id === Number(line.sizeId)) : undefined;
      return {
        dealId,
        menuItemId: item.id,
        menuItemName: item.name,
        sizeId: size?.id ?? null,
        sizeName: size?.name ?? null,
        quantity: Math.max(1, Number(line.quantity) || 1),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (values.length) await db.insert(dealItems).values(values);
}

/** Extras / add-ons. */
export async function listExtras() {
  return db.select().from(menuExtras).orderBy(asc(menuExtras.name));
}

/**
 * Guard for hard-deleting a category: refuse while menu items still reference it,
 * so the admin deactivates instead of silently orphaning products.
 */
export async function categoryItemCount(categoryId: number): Promise<number> {
  const rows = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.categoryId, categoryId));
  return rows.length;
}

/** Guard for hard-deleting a menu item: refuse while it is part of any deal. */
export async function menuItemDealCount(menuItemId: number): Promise<number> {
  const rows = await db.select({ id: dealItems.id }).from(dealItems).where(eq(dealItems.menuItemId, menuItemId));
  return rows.length;
}
