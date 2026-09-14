import { getCurrentAdmin } from "@/modules/authentication/adminAuth.service";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR, fileUrl } from "@/modules/restaurant/uploadStorage";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB

/**
 * Stores an uploaded picture on the server filesystem under /public/uploads and
 * returns its public URL. Only the URL is saved in Postgres — image binaries are
 * never written to the database.
 *
 * See uploadStorage.ts for the production object-storage swap-out note.
 */
export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file uploaded" }, { status: 400 });
  if (!ALLOWED.includes(file.type))
    return Response.json({ error: "Only JPG, PNG, WEBP or GIF images are allowed" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return Response.json({ error: "Image must be 3 MB or smaller" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const filename = `${randomUUID()}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));

  return Response.json({ url: fileUrl(filename) }, { status: 201 });
}
