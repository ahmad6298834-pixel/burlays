"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { CustomerSlip, KitchenSlip } from "./OrderSlips";
import type { RestaurantOrderFull, RestaurantSettings } from "@/types";

/**
 * Standalone page for ONE slip — Kitchen Ticket or Customer Receipt.
 *
 * The two slips remain completely separate documents, each with its own print
 * action, exactly as before. Both render from the shared components in
 * OrderSlips.tsx so their content can never drift apart.
 */
export default function SingleSlipPage({
  params,
  kind,
}: {
  params: Promise<{ id: string }>;
  kind: "kitchen" | "customer";
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<RestaurantOrderFull | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [width, setWidth] = useState<"58" | "80">("80");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/restaurant/orders/${id}`).then((r) => r.json()),
      fetch("/api/restaurant/settings").then((r) => r.json()),
    ]).then(([o, s]) => {
      setOrder(o?.id ? o : null);
      setSettings(s);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading slip...</div>;
  if (!order) return <div className="p-8 text-sm text-slate-500">Order not found.</div>;

  const isKitchen = kind === "kitchen";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="no-print mx-auto mb-6 flex max-w-md flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <Link href="/restaurant/orders" className="text-sm text-indigo-600 hover:underline">
            ← Restaurant Orders
          </Link>
          <span className="text-sm font-semibold text-slate-700">{order.orderNumber}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Paper:</span>
          {(["58", "80"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              className={`rounded-md border px-2 py-1 text-xs ${
                width === w ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300"
              }`}
            >
              {w}mm
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" onClick={() => window.print()}>
            {isKitchen ? "👨‍🍳 Print Kitchen Ticket" : "🧾 Print Customer Receipt"}
          </Button>
          <Link href={`/restaurant/orders/${id}/${isKitchen ? "receipt" : "kitchen"}`} className="flex-1">
            <Button variant="secondary" className="w-full">
              {isKitchen ? "🧾 Customer Receipt" : "👨‍🍳 Kitchen Ticket"}
            </Button>
          </Link>
        </div>
      </div>

      <div id="print-receipt" className="mx-auto max-w-md shadow-sm">
        {isKitchen ? (
          <KitchenSlip order={order} settings={settings} width={width} />
        ) : (
          <CustomerSlip order={order} settings={settings} width={width} />
        )}
      </div>
    </div>
  );
}
