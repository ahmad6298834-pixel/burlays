import { db } from "@/db";
import { riders } from "@/db/schema";
import { hashPassword } from "@/modules/authentication/auth.service";
import { getRiderFinancialsMap } from "@/modules/riders/riderFinancials.service";
import { asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const list = await db.select().from(riders).orderBy(asc(riders.name));
  const financials = await getRiderFinancialsMap();

  const result = list.map((rider) => {
    const { passwordHash: _passwordHash, pushToken: _pushToken, ...safeRider } = rider;
    return {
      ...safeRider,
      hasAppLogin: Boolean(rider.email && rider.passwordHash),
      financials: financials.get(rider.id) ?? {
        riderId: rider.id,
        deliveredCount: 0,
        earnings: 0,
        advances: 0,
        payments: 0,
        adjustments: 0,
        balance: 0,
      },
    };
  });

  return Response.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return Response.json({ error: "Rider name is required" }, { status: 400 });
  }
  const phone = body.phone ? String(body.phone).trim() : null;
  const email = body.email ? String(body.email).trim().toLowerCase() : null;
  const password = body.password ? String(body.password) : null;

  if (email && !password) {
    return Response.json({ error: "Password is required when setting up app login" }, { status: 400 });
  }
  if (password && !email) {
    return Response.json({ error: "Email is required when setting up app login" }, { status: 400 });
  }

  if (email) {
    const [existing] = await db.select().from(riders).where(eq(riders.email, email)).limit(1);
    if (existing) {
      return Response.json({ error: "A rider with this email already exists" }, { status: 409 });
    }
  }

  const passwordHash = password ? await hashPassword(password) : null;

  const [created] = await db.insert(riders).values({ name, phone, email, passwordHash }).returning();
  const { passwordHash: _ph, pushToken: _pt, ...safeCreated } = created;
  return Response.json(safeCreated, { status: 201 });
}
