import path from "path";

/**
 * Runtime directory for uploaded pictures.
 *
 * Deliberately NOT inside /public: Next.js snapshots public/ at build time, so
 * files written after the build would not be served. Files here are streamed by
 * the /api/files/[name] route instead.
 *
 * PRODUCTION NOTE: on an ephemeral/read-only host (Vercel serverless), set
 * UPLOAD_DIR to a mounted volume, or replace the write in /api/uploads with an
 * object-storage upload (S3 / R2 / Supabase Storage). Only that one function
 * changes — everything else just stores and renders the returned URL string.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "storage", "uploads");

/** Public URL for a stored file. */
export const fileUrl = (filename: string) => `/api/files/${filename}`;
