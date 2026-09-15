import { findCustomerByPhone } from "@/modules/customers/customers.service";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Looks up a customer by phone number for the Assign Order form's auto-fill.
 * Returns { customer: null } (not a 404) when no match is found, since "not found"
 * is an expected, normal outcome here (e.g. a brand-new customer).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone") ?? "";

  if (!phone.trim()) {
    return Response.json({ error: "Phone number is required" }, { status: 400 });
  }

  const customer = await findCustomerByPhone(phone);
  return Response.json({ customer });
}
