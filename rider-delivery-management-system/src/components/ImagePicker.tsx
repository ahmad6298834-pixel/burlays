"use client";

import { useRef, useState } from "react";
import { Button, Label } from "@/components/ui";

/**
 * Upload / preview / replace / remove a picture. Uploads go to /api/uploads and
 * only the returned URL is kept in component state, so callers just persist a
 * plain string on their record.
 */
export default function ImagePicker({
  value,
  onChange,
  label = "Image (optional)",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    setError("");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    setUploading(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error ?? "Upload failed");
      return;
    }
    onChange(d.url);
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
          {value && (
            <Button variant="ghost" className="text-rose-600" onClick={() => onChange(null)}>
              Remove Image
            </Button>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
