import { db } from "@/db";
import { riderTransactions } from "@/db/schema";
import { getCurrentAdmin } from "@/modules/authentication/adminAuth.service";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const VALID_TYPES = ["advance", "payment", "adjustment"];

/**
 * Edits a rider ledger transaction (amount, date, note, type).
 *
 * The rider's ledger, outstanding balance, dashboard figures and reports are all
 * computed live from these rows, so they recalculate automatically on save —
 * no stored balance needs patching. Delivery earnings come from delivered
 * orders and are untouched by this endpoint.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const txId = Number(id);
  if (Number.isNaN(txId)) return Response.json({ error: "Invalid transaction id" }, { status: 400 });

  const [existing] = await db.select().from(riderTransactions).where(eq(riderTransactions.id, txId)).limit(1);
  if (!existing) return Response.json({ error: "Transaction not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const updates: Partial<typeof riderTransactions.$inferInsert> = {};

  if (body.type !== undefined) {
    const type = String(body.type);
    if (!VALID_TYPES.includes(type)) return Response.json({ error: "Invalid transaction type" }, { status: 400 });
    updates.type = type;
  }

  if (body.amount !== undefined) {
    const raw = Number(body.amount);
    if (Number.isNaN(raw) || raw === 0) {
      return Response.json({ error: "Amount must be a non-zero number" }, { status: 400 });
    }
    // Advances and payments are always stored positive; adjustments may be negative.
    const type = updates.type ?? existing.type;
    updates.amount = type === "adjustment" ? raw : Math.abs(raw);
  }

  if (typeof body.date === "string" && body.date.trim()) updates.date = body.date.trim();
  if (typeof body.note === "string") updates.note = body.note.trim() || null;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(riderTransactions)
    .set(updates)
    .where(eq(riderTransactions.id, txId))
    .returning();
  return Response.json(updated);
}

/**
 * Removes a ledger transaction. Because balances are derived, deleting the row
 * cleanly reverses it everywhere (ledger, outstanding advance, payable /
 * receivable balance, dashboard and reports).
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const txId = Number(id);
  if (Number.isNaN(txId)) return Response.json({ error: "Invalid transaction id" }, { status: 400 });

  const [existing] = await db.select().from(riderTransactions).where(eq(riderTransactions.id, txId)).limit(1);
  if (!existing) return Response.json({ error: "Transaction not found" }, { status: 404 });

  await db.delete(riderTransactions).where(eq(riderTransactions.id, txId));
  return Response.json({ ok: true });
}
