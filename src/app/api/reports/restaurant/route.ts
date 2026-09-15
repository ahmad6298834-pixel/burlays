import { buildRestaurantReport, resolveRange } from "@/modules/reports/restaurantReports.service";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const { from, to } = resolveRange(
    searchParams.get("preset"),
    searchParams.get("from"),
    searchParams.get("to")
  );

  const riderId = searchParams.get("riderId");
  const locationId = searchParams.get("locationId");

  const report = await buildRestaurantReport({
    from,
    to,
    orderType: searchParams.get("orderType"),
    paymentMethod: searchParams.get("paymentMethod"),
    riderId: riderId ? Number(riderId) : null,
    locationId: locationId ? Number(locationId) : null,
  });

  return Response.json(report);
}
