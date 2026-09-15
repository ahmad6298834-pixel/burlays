"use client";

import { useRef, useState } from "react";
import { Button, Label } from "@/components/ui";

const MAX_MB = 8;
const ACCEPTED = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

/**
 * Upload / preview / replace / remove a picture. Uploads go to /api/uploads and
 * only the returned URL is kept, so callers just persist a plain string.
 *
 * Errors are surfaced verbatim from the API. If the server returns a non-JSON
 * body (proxy error page, oversized request, etc.) we fall back to a message
 * built from the HTTP status rather than a useless generic "Upload failed".
 */
export default function ImagePicker({
  value,
  onChange,
  label = "Image (optional)",
  onUploadingChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const setBusy = (v: boolean) => {
    setUploading(v);
    onUploadingChange?.(v);
  };

  const upload = async (file: File) => {
    setError("");

    // Fail fast client-side so the user gets an instant, specific message.
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum size is ${MAX_MB} MB.`);
      return;
    }
    if (!file.type.startsWith("image/") && !ACCEPTED.test(file.name)) {
      setError("Unsupported file type. Please use JPG, PNG, WEBP, GIF, BMP or HEIC.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });

      const raw = await res.text();
      let data: { url?: string; error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        // Non-JSON body (e.g. proxy 413 HTML page).
        data = {};
      }

      if (!res.ok || !data.url) {
        setError(
          data.error ??
            (res.status === 413
              ? `Image is too large. Maximum size is ${MAX_MB} MB.`
              : `Upload failed (server responded ${res.status}). Please try again.`)
        );
        return;
      }
      onChange(data.url);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        {/* Preview, or a clean placeholder when there is no image */}
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl text-slate-300">🍽️</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading..." : value ? "Replace Image" : "Upload Image"}
          </Button>
          {value && !uploading && (
            <Button variant="ghost" className="text-rose-600" onClick={() => onChange(null)}>
              Remove Image
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-400">JPG, PNG, WEBP, GIF, BMP or HEIC · up to {MAX_MB} MB</p>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
