import { authenticateRider } from "@/modules/authentication/auth.service";
import { getRiderLedger } from "@/modules/riders/riderFinancials.service";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rider = await authenticateRider(request);
  if (!rider) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getRiderLedger(rider.id);
  if (!data) {
    return Response.json({ error: "Rider not found" }, { status: 404 });
  }

  return Response.json(data);
}
