"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ORDER_TYPE_LABELS, RESTAURANT_NAME } from "@/types";
import type { RestaurantOrderFull, RestaurantOrderType, RestaurantSettings } from "@/types";

/**
 * Kitchen Ticket — strictly what the kitchen needs to cook.
 *
 * Contains ONLY: BURLASY header, order number, order type, and each line's
 * item name, size (if any), quantity and selected extras (if any).
 *
 * Deliberately EXCLUDES customer name, customer phone, rider name, delivery
 * location, delivery charge, customer total and payment details. Anything
 * commercial or delivery-related belongs on the customer receipt, not here.
 */
export default function KitchenTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<RestaurantOrderFull | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [width, setWidth] = useState<"58" | "80">("80");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/restaurant/settings")
      .then((r) => r.json())
      .then(setSettings);
    fetch(`/api/restaurant/orders/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setOrder(d?.id ? d : null);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading ticket...</div>;
  if (!order) return <div className="p-8 text-sm text-slate-500">Order not found.</div>;

  const orderTypeLabel = (ORDER_TYPE_LABELS[order.orderType as RestaurantOrderType] ?? order.orderType).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="no-print mx-auto mb-6 flex max-w-md flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <Link href="/restaurant/pos" className="text-sm text-indigo-600 hover:underline">
          ← Back to POS
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
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
          <div className="flex gap-2">
            <Link
              href={`/restaurant/orders/${id}/receipt`}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              🧾 Customer Receipt
            </Link>
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              👨‍🍳 Print Kitchen Ticket
            </button>
          </div>
        </div>
      </div>

      <div
        id="print-receipt"
        className={`mx-auto ${
          width === "58" ? "w-[58mm]" : "w-[80mm]"
        } bg-white p-3 font-mono text-[13px] leading-tight text-black shadow-sm`}
      >
        <div className="text-center">
          <p className="text-[17px] font-bold tracking-wide">{(settings?.name ?? RESTAURANT_NAME).toUpperCase()}</p>
          <p className="text-[15px] font-bold">ORDER #{order.orderNumber}</p>
          <p className="text-[15px] font-bold">{orderTypeLabel}</p>
        </div>

        <p>------------------------------</p>

        {order.items.map((line) => (
          <div key={line.id} className="mb-2">
            {/* e.g. "Chicken Pizza - Large x1" */}
            <p className="text-[14px] font-bold">
              {line.name}
              {line.sizeName ? ` - ${line.sizeName}` : ""} x{line.quantity}
            </p>

            {/* Products contained in a deal */}
            {line.dealItems.length > 0 && (
              <div className="pl-3">
                {line.dealItems.map((d) => (
                  <p key={d.id}>
                    - {d.name}
                    {d.sizeName ? ` - ${d.sizeName}` : ""} x{d.quantity}
                  </p>
                ))}
              </div>
            )}

            {/* Selected extras / add-ons (no prices — kitchen only needs the what) */}
            {line.extras.length > 0 && (
              <div className="pl-3">
                {line.extras.map((e) => (
                  <p key={e.id}>+ {e.name}</p>
                ))}
              </div>
            )}
          </div>
        ))}

        <p>------------------------------</p>
        <p className="text-center">** END OF ORDER **</p>
      </div>
    </div>
  );
}
