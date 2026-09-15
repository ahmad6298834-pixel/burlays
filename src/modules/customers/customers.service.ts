import { db } from "@/db";
import { customers, locations } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Normalizes a phone number for consistent lookups (strips spaces/dashes). */
export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[\s-]/g, "");
}

/** Finds the customer master record for a phone number, if one exists. */
export async function findCustomerByPhone(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  return customer ?? null;
}

/**
 * Creates or updates the customer master record for a phone number.
 *
 * - If the phone number is new, a customer record is created.
 * - If the phone number already exists, the name/default location are refreshed to
 *   match the latest order (so future orders auto-fill with the most recent info).
 *
 * This NEVER touches past orders — each order keeps its own independent snapshot of
 * customerName/customerPhone/locationName/deliveryCharge, so editing the customer
 * master record (here) cannot change historical order data.
 */
export async function upsertCustomer(params: {
  phone: string;
  name: string;
  locationId?: number | null;
  locationName?: string | null;
}) {
  const phone = normalizePhone(params.phone);
  if (!phone) return null;

  const name = params.name.trim();
  if (!name) return null;

  let locationId = params.locationId ?? null;
  let locationName = params.locationName ?? null;

  // Re-derive the location name if only an id was provided.
  if (locationId && !locationName) {
    const [location] = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
    locationName = location?.name ?? null;
  }

  const existing = await findCustomerByPhone(phone);

  if (existing) {
    const [updated] = await db
      .update(customers)
      .set({
        name,
        defaultLocationId: locationId,
        defaultLocationName: locationName,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(customers)
    .values({
      phone,
      name,
      defaultLocationId: locationId,
      defaultLocationName: locationName,
    })
    .returning();
  return created;
}
