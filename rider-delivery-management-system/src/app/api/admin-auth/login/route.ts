import { createSession, verifyAdminCredentials } from "@/modules/authentication/adminAuth.service";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const identifier = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "");

  if (!identifier || !password) {
    return Response.json({ error: "Username/email and password are required" }, { status: 400 });
  }

  

  const admin = await verifyAdminCredentials(identifier, password);
  if (!admin) {
    // Deliberately generic so the response cannot be used to enumerate accounts.
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  await createSession({
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    v: admin.sessionVersion,
  });
  return Response.json({ ok: true, name: admin.name, role: admin.role });
}
