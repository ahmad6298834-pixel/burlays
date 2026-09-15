import { authenticateRider } from "@/modules/authentication/auth.service";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rider = await authenticateRider(request);
  if (!rider) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    id: rider.id,
    name: rider.name,
    email: rider.email,
    phone: rider.phone,
    active: rider.active,
  });
}
