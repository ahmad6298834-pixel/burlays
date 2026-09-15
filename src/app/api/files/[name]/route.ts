import { readFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { UPLOAD_DIR } from "@/modules/restaurant/uploadStorage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

/**
 * Serves an uploaded picture from the runtime upload directory.
 *
 * Files cannot live in /public because Next.js snapshots that folder at build
 * time — anything written after the build would 404 in production.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  // Reject any traversal attempt; only a bare filename is ever valid.
  const safe = path.basename(name);
  if (safe !== name) return new Response("Not found", { status: 404 });

  const ext = path.extname(safe).toLowerCase();
  if (!TYPES[ext]) return new Response("Not found", { status: 404 });

  try {
    const buf = await readFile(path.join(UPLOAD_DIR, safe));
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
