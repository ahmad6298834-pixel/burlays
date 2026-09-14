import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { riders } from "@/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET ?? "riderdash_dev_secret_change_me";
const TOKEN_EXPIRY = "30d";

export type RiderTokenPayload = {
  riderId: number;
  email: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signRiderToken(payload: RiderTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyRiderToken(token: string): RiderTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "object" && decoded && "riderId" in decoded) {
      return decoded as RiderTokenPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

/**
 * Authenticates a rider request. Returns the active rider record if the token is
 * valid and the rider is still active, otherwise returns null. Always re-checks the
 * database (not just the JWT payload) so a deactivated rider is rejected immediately
 * even if their token has not expired yet.
 */
export async function authenticateRider(request: NextRequest) {
  const token = extractBearerToken(request);
  if (!token) return null;

  const payload = verifyRiderToken(token);
  if (!payload) return null;

  const [rider] = await db.select().from(riders).where(eq(riders.id, payload.riderId)).limit(1);
  if (!rider) return null;
  if (!rider.active) return null;

  return rider;
}
