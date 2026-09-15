import { db } from "@/db";
import { menuCategories } from "@/db/schema";
import { listCategories } from "@/modules/restaurant/restaurant.service";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await listCategories());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) return Response.json({ error: "Category name is required" }, { status: 400 });

  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  const [created] = await db.insert(menuCategories).values({ name, sortOrder }).returning();
  return Response.json(created, { status: 201 });
}
