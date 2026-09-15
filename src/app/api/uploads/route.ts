import { getCurrentAdmin } from "@/modules/authentication/adminAuth.service";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR, fileUrl } from "@/modules/restaurant/uploadStorage";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** 8 MB — comfortably fits a modern phone photo. */
const MAX_BYTES = 8 * 1024 * 1024;

/** Extensions we can both store and serve back. */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
};

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp"]);

/**
 * Resolves a safe, servable file extension.
 *
 * Browsers are inconsistent: drag-and-drop and some Android pickers send
 * `application/octet-stream` with no usable MIME type, so we fall back to the
 * filename extension before rejecting the upload.
 */
function resolveExtension(file: File): string | null {
  const byMime = EXT_BY_MIME[file.type?.toLowerCase() ?? ""];
  if (byMime) return byMime;

  const raw = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (ALLOWED_EXT.has(raw)) return raw === "jpeg" ? "jpg" : raw;

  return null;
}

/**
 * Stores an uploaded picture on disk and returns its URL. Only the URL is saved
 * in Postgres — image binaries are never written to the database.
 *
 * Every failure path returns JSON with a human-readable `error`, so the UI can
 * always show a useful message instead of a generic "Upload failed".
 * See uploadStorage.ts for the production object-storage swap-out note.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return Response.json({ error: "Your session expired. Please sign in again." }, { status: 401 });

    // Reject oversized uploads up-front using the declared length, so we never
    // try to buffer a huge body (which previously crashed with an empty 500).
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared && declared > MAX_BYTES + 1024 * 512) {
      return Response.json(
        { error: `Image is too large. Maximum size is ${MAX_BYTES / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json(
        { error: `Could not read the image. It may be too large (max ${MAX_BYTES / (1024 * 1024)} MB).` },
        { status: 413 }
      );
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "No image was selected." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json(
        { error: `Image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum size is ${MAX_BYTES / (1024 * 1024)} MB.` },
        { status: 400 }
      );
    }

    const ext = resolveExtension(file);
    if (!ext) {
      return Response.json(
        { error: "Unsupported file type. Please use JPG, PNG, WEBP, GIF, BMP or HEIC." },
        { status: 400 }
      );
    }

    const filename = `${randomUUID()}.${ext}`;
    try {
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      console.error("Image write failed", err);
      return Response.json({ error: "Could not save the image on the server. Please try again." }, { status: 500 });
    }

    return Response.json({ url: fileUrl(filename) }, { status: 201 });
  } catch (err) {
    console.error("Upload failed", err);
    return Response.json({ error: "Unexpected error while uploading the image." }, { status: 500 });
  }
}
